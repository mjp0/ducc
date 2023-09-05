import { ModuleS, BasePayloadS, BasePayloadT, CallbacksT, RequestAPIT, ErrorT, SignedTransactionS } from "@/schemas"
import { createChallenge, verifyAuth } from "@/security"
import { z } from "zod"
import { Request } from "@/request"
import { eventsServer } from "@/channels"
import _ from "lodash"
import { ServerAPIT } from "@/schemas/server"
import { router } from "@/router"
import { debug, parseNumber, varToByte } from "@/utils"
import { handshakeModule } from "@/modules/handshake"
import { walletModule } from "./modules/wallet"
import { asAPI } from "./modules"

const d = debug("server")
const MODULES: z.infer<typeof ModuleS>[] = []
const PROTOCOLS: any = []
const GLOBALS: { [key: string]: any } = {}
const REQUESTS: { [key: string]: RequestAPIT | boolean } = {}

export async function Server({
  modules,
  protocols,
  globals,
  type = "events",
  no_auth = false,
}: {
  modules: z.infer<typeof ModuleS>[]
  protocols?: { id: string; logic: any }[]
  globals?: any
  type?: "events" | "websocket"
  no_auth?: boolean
}) {
  // set globals
  if (globals) {
    for (const key in globals) {
      d(`setting global ${key}`)
      GLOBALS[key] = globals[key]
    }
  }

  // validate all Modules and Protocols
  modules = [...modules, handshakeModule, walletModule]
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
      d(`executing ${input.router.id}:${input.router.path} / ${input.id}`)
      const parsed_input = BasePayloadS.safeParse(input)
      if (!parsed_input.success) return { error: `Invalid payload`, code: 400 }

      // if this is a challenge request, generate challenge and response
      if (!no_auth && input.router.id === "handshake" && input.router.path === "/challenge") {
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
      const m = MODULES.find((m) => m.id === input.router.id)
      const p = m?.schema?.paths[input.router.path]?.post
      if (!p) return { error: `Invalid module method`, code: 404 }

      // check if tags have multiplier=x
      const multiplier = parseNumber(p.tags?.find((t: string) => t.startsWith("multiplier="))?.split("=")[1] || "0")
      const t = typeof multiplier
      if (multiplier && typeof multiplier === 'number') {
        // check if tx is present
        if (!input.signed_transaction) return { error: `Missing tx`, code: 400 }

        // verify transaction
        if(!SignedTransactionS.safeParse(input.signed_transaction).success) {
          return { error: `Invalid tx`, code: 400 }
        }

        // verify user has enough balance
        const wallet = asAPI(walletModule)
        const balance = await wallet.getBalance({ user_id: input.meta.user_id }) || 0

        if(!balance?.result) return { error: `Invalid balance`, code: 400 }

        const params_cost = await varToByte(input.params || {})

        const total_cost = params_cost * multiplier

        if(total_cost > balance?.result) return { error: `Insufficient balance`, code: 402 }
      }

      // setup the request
      const request = await Request({
        module_id: input.router.id,
        method_id: input.router.path,
        request_id: input.id,
        onData,
        onDone,
        onError,
        tx: input.signed_transaction || undefined,
      })
      if ("error" in request) return { error: request.error, code: 500 }

      return router({
        input: { ...parsed_input.data, params: input?.params || null } || {},
        globals: { MODULES, PROTOCOLS, REQUESTS, ...GLOBALS, ...globals },
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
  }

  switch (type) {
    case "events":
      eventsServer({ API })
      break
    case "websocket":
      return { error: "websocket server not implemented yet", code: 500 }
      // websocketServer({ API })
      break
  }

  return API
}
