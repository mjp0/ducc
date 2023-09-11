import { Server } from "@/server"
import {
  BasePayloadT,
  ClientAPIT,
  ComputeT,
  ErrorT,
  ModuleT,
  SignedTransactionT,
  WritebacksT,
} from "@/schemas"
import { events } from "@/channels/channel.events"
import { websocket } from "@/channels/channel.websocket"
import { nanoid } from "nanoid"
import { buf2hex, createHash, hex2buf, signMessage } from "@/security"
import { devMode } from "@/utils"

export async function Client<T>({
  host = "localhost",
  type = "events",
  server_modules = [],
  server_private_key,
}: {
  host?: string
  type: "websocket" | "events"
  server_modules?: ModuleT[]
  server_private_key?: string
}): Promise<(ClientAPIT & { host: string; type: string }) | ErrorT> {
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
    request: async ({ user, offer, params, tx }) => {
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
            params,
            offer: {
              id: "handshake",
              call: {
                module_id: "handshake",
                method_id: "challenge",
              },
              sig: {
                n: "",
                c: "",
                s: "",
                pk: user.public_key,
              },
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
        str: JSON.stringify({ offer, params: params || {}, nonce: challenge?.data?.challenge, request_id }),
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
        str: JSON.stringify({ offer, params: params || {}, request_id, max_spent: tx?.max_spent || 0 }),
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
        params,
        auth,
        signed_transaction,
        offer,
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
    const server = await Server({
      modules: server_modules,
      type: "events",
      private_key: server_private_key || undefined,
    })
    if ("error" in server) {
      throw new Error(JSON.stringify(server.error))
    }
  }
  return { ...API, host, type }
}
