import { ModuleS, BasePayloadS, BasePayloadT, CallbacksT, RequestAPIT, ErrorT, SignedTransactionS, OfferT } from "@/schemas"
import {getPublicKeyFromPrivate, buf2hex, createChallenge, createHash, hex2buf, keyPair, signMessage, verifyAuth } from "@/security"
import { z } from "zod"
import { Request } from "@/request"
import { eventsServer } from "@/channels/channel.events"
import { websocketServer } from "@/channels/channel.websocket"
import _ from "lodash"
import { ServerAPIT } from "@/schemas/server"
import { router } from "@/router"
import { debug, parseNumber, varToByte } from "@/utils"
import { handshakeModule } from "@/modules/handshake"
import { walletModule } from "./modules/wallet"
import { asAPI } from "./modules"
import { nanoid } from "nanoid"

const d = debug("server")
const MODULES: z.infer<typeof ModuleS>[] = []
const PROTOCOLS: any = []
const GLOBALS: { [key: string]: any } = {}
const REQUESTS: { [key: string]: RequestAPIT | boolean } = {}

export async function Server({
  modules = [],
  private_key,
  protocols,
  globals,
  type = "events",
  no_auth = false,
  host = '127.0.0.1',
  port = 8080
}: {
  modules: z.infer<typeof ModuleS>[]
  private_key?: string
  protocols?: { id: string; logic: any }[]
  globals?: any
  type?: "events" | "websocket"
  no_auth?: boolean
  host?: string
  port?: number
}) {
  // generate private key if one is not set
  if (!private_key) private_key = (await keyPair()).private_key

  // set globals
  if (globals) {
    for (const key in globals) {
      d(`setting global ${key}`)
      GLOBALS[key] = globals[key]
    }
  }

  // validate all Modules and Protocols
  modules = [...modules, await handshakeModule(), await walletModule()]
  for (const module of modules) {
    const is_valid_module = ModuleS.safeParse(module)
    if (!is_valid_module.success) {
      d(`invalid module ${module.id}`)
      throw new Error(`Invalid Module`)
    }
    MODULES.push(module)
    d(`loaded module ${module.id}`)
  }
  if (protocols) {
    for (const protocol of protocols) {
      if (!BasePayloadS.safeParse(protocol).success) throw new Error(`Invalid Protocol`)
      PROTOCOLS.push(protocol)
      d(`loaded protocol ${protocol.id}`)
    }
  }

  // setup API
  const API: ServerAPIT = {
    getModules: () => MODULES,
    execute: async function ({
      input,
      globals,
      onData,
      onDone,
      onError,
    }: {
      input: BasePayloadT
      globals?: { ip: string; [key: string]: any }
    } & CallbacksT) {
      d(`executing ${input.offer.call.module_id}:${input.offer.call.method_id} / ${input.id}`)
      const parsed_input = BasePayloadS.safeParse(input)
      if (!parsed_input.success) return { error: `Invalid payload`, code: 400 }

      // if this is a challenge request, generate challenge and response
      if (!no_auth && input.offer.call.module_id === "handshake" && input.offer.call.method_id === "challenge") {
        // TODO: refactor this into something cleaner
        const done = async (data: any) => {
          const challenge = data.result
          if (!challenge) return onError({ error: "Invalid challenge", code: 400 })
          onDone({ request_id: input.id, status: "challenge", data: { challenge } })
        }
        return router({
          input: { ...parsed_input.data, params: { request_id: input.id, ip: globals?.ip || "localhost" } },
          globals: { MODULES, PROTOCOLS, REQUESTS, ...GLOBALS, ...globals },
          request: {
            request_id: input.id,
            abort: async () => {},
            setAbort: async () => {},
            onDone: done,
            onError,
          },
          onData,
          onDone: done,
          onError,
        })
      }

      // if this is an authorized call, verify the auth
      if (!no_auth) {
        const is_authorized = await verifyAuth({ ...input, request_id: input.id, ip: globals?.ip || "localhost" })
        if (!is_authorized) return { error: "Unauthorized", code: 401 }
      }

      // check if request is paid and if its paid, check it includes tx
      const m = MODULES.find((m) => m.id === input.offer.call.module_id)
      const p = m?.schema?.paths[`/${input.offer.call.method_id}`]?.post
      if (!p) return { error: `Invalid module method`, code: 404 }

      // check if tags have multiplier=x
      const multiplier = parseNumber(p.tags?.find((t: string) => t.startsWith("multiplier="))?.split("=")[1] || "0")
      const t = typeof multiplier

      // if there's a multiplier, this is paid request and we need to check if user has enough balance
      if (multiplier && typeof multiplier === "number") {
        // check if tx is present
        if (!input.signed_transaction) return { error: `Missing tx`, code: 400 }

        // verify transaction
        if (!SignedTransactionS.safeParse(input.signed_transaction).success) {
          return { error: `Invalid tx`, code: 400 }
        }

        // verify user has enough balance
        const wallet = asAPI(await walletModule())
        const balance = (await wallet.getBalance({ user_id: input.meta.user_id })) || 0

        if (balance?.result === undefined) return { error: `Invalid balance`, code: 400 }

        const params_cost = await varToByte(input.params || {})

        const total_cost = params_cost * multiplier

        if (total_cost > balance?.result) return { error: `Insufficient balance`, code: 402 }
      }

      // setup the request
      const request = await Request({
        module_id: input.offer.call.module_id,
        method_id: input.offer.call.method_id,
        request_id: input.id,
        onData,
        onDone,
        onError,
        tx: input.signed_transaction || undefined,
      })
      if ("error" in request) return { error: request.error, code: 500 }

      return router({
        input: { ...parsed_input.data, params: input?.params || null } || {},
        globals: { MODULES, PROTOCOLS, REQUESTS, ...GLOBALS, ...globals, private_key },
        request,
        onData,
        onDone,
        onError,
      })
    },
    abort: async function ({ request_id }: { request_id: string }) {
      const request = REQUESTS[request_id]
      if (!request) return { error: `Unknown request`, code: 404 }
      return typeof request === "object" && request.abort()
    },
    registerModule: async function ({ module }: { module: z.infer<typeof ModuleS> }) {
      if (!ModuleS.safeParse(module).success) return { error: `Invalid Module`, code: 400 }
      MODULES.push(module)
      return { code: 200 }
    },
    signOffer: async function (offer) {
      if(!private_key) return { error: `No private key`, code: 500 }
      const offer_hash = createHash({ str: JSON.stringify(offer) })
      const signature = await signMessage(offer_hash, hex2buf({ input: private_key }))
      const off: OfferT = {
        ...offer,
        id: nanoid(),
        sig:  {
          c: buf2hex({ input: offer_hash }),
          s: buf2hex({ input: signature }),
          pk: await getPublicKeyFromPrivate({ private_key })
        }
      }
      return off
    },
  }

  switch (type) {
    case "events":
      eventsServer({ API })
      break
    case "websocket":
      websocketServer({ API, host, port })
      break
  }

  return { ...API, host, type }
}
