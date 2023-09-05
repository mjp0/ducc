import { Server } from "@/server"
import {
  BasePayloadT,
  CallT,
  CallbacksT,
  ClientAPIT,
  ComputeT,
  ErrorT,
  ModuleT,
  RequestT,
  SignedTransactionT,
  WritebacksT,
} from "@/schemas"
import { events, websocket } from "./channels"
import { nanoid } from "nanoid"
import { buf2hex, createHash, hex2buf, signMessage } from "./security"
import { devMode } from "./utils"

export async function Client<T>({
  host,
  type = "events",
  server_modules = [],
}: {
  host?: string
  type: "websocket" | "events"
  server_modules?: ModuleT[]
}): Promise<ClientAPIT | ErrorT> {
  // setup channel
  let channel: Function | undefined
  switch (type) {
    case "websocket":
      channel = websocket
      break
    case "events":
      channel = events
      break
  }

  const API: ClientAPIT = {
    request: async ({ user, module_id, method_id, params, tx }) => {
      const router = {
        id: module_id,
        path: `/${method_id}`,
        method: "post",
      }

      // create request_id
      const request_id = nanoid()

      // get challenge from the server
      const challenge_fetch = new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => {
            reject("timeout")
          },
          devMode() ? 1000000 : 10000
        )
        API.compute({
          onData: () => {},
          onDone: (data) => {
            clearTimeout(timeout)
            resolve(data.data)
          },
          onError: (error) => {
            clearTimeout(timeout)
            reject(error)
          },
          request: {
            id: request_id,
            meta: {
              user_id: user.user_id,
            },
            router: {
              id: "handshake",
              path: "/challenge",
              method: "post",
            },
            auth: {
              n: "",
              c: "",
              s: "",
              pk: user.public_key,
            },
          },
        })
      })
      const [challenge] = (await Promise.all([challenge_fetch])) as [{ data: { challenge: string } | undefined }]

      // check challenge
      if (!challenge?.data?.challenge) return { error: "Invalid challenge", code: 400 }

      // compute signature with the challenge
      const request_hash = createHash({
        str: JSON.stringify({ router, params: params || {}, nonce: challenge?.data?.challenge, request_id }),
      })
      const t = buf2hex({ input: request_hash })
      const signature = await signMessage(request_hash, hex2buf({ input: user.private_key }))

      // create request authentication
      const auth = {
        n: challenge?.data?.challenge,
        c: buf2hex({ input: request_hash }),
        s: buf2hex({ input: signature }),
        pk: user.public_key,
      }

      // create signed transaction
      const tx_hash = createHash({
        str: JSON.stringify({ router, params: params || {}, request_id, max_spent: tx?.max_spent || 0 }),
      })
      const tx_signature = await signMessage(tx_hash, hex2buf({ input: user.private_key }))

      const signed_transaction: SignedTransactionT = {
        max_spent: tx?.max_spent || 0,
        signature: {
          c: buf2hex({ input: tx_hash }),
          s: buf2hex({ input: tx_signature }),
          pk: user.public_key,
        },
      }

      const req: BasePayloadT = {
        id: request_id,
        meta: {
          user_id: user.user_id,
        },
        router,
        params,
        auth,
        signed_transaction,
      }

      return req
    },
    compute: async ({ request, onData, onDone, onError }) => {
      if (!channel) return { error: "Invalid channel type", code: 400 }
      const { write, close } = (await channel({
        request_id: request.id,
        host,
        onData,
        onDone,
        onError,
      })) as WritebacksT
      write({ input: request })
      const requestAPI: ComputeT = {
        abort: () => {
          write({ input: request, abort: true })
        },
      }
      return requestAPI
    },
  }

  // if host is set at localhost, start event-based server
  if (host === "localhost") {
    const server = await Server({ modules: server_modules, type: "events" })
    if ("error" in server) throw new Error(server.error)
  }
  return API
}
