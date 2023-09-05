import { z } from "zod"
import EventBus from "./events"
import {
  BasePayloadT,
  CallbacksT,
  ChannelMessageT,
  ErrorT,
  MessageT,
  DoneMessageT,
  WritebacksT,
  DataMessageT,
  ReadyMessageT,
  ModuleS,
  BasePayloadS,
} from "@/schemas"
import { ServerAPIT } from "./schemas/server"

let WSS: WebSocket

export type ChannelT = {
  write: ({ msg, status }: { msg?: any; status: number }) => Promise<void>
  error: (err: any) => Promise<void>
  end: () => Promise<boolean>
}

async function processMessage({ request_id, data, onData, onDone, onError }: ChannelMessageT & CallbacksT) {
  if ("error" in data) {
    return onError && onError(data)
  }
  // first response should be { request_id: "...", status: "ready" }
  if (data.request_id && data.status === "ready") {
    request_id = data.request_id
    return
  } else if (data.request_id === request_id && data.status === "data") {
    // all subsequent responses should be { request_id: "...", data: "..." }
    const d = data as DataMessageT
    return onData && onData(d)
  } else if (data.request_id === request_id && data.status === "complete") {
    const d = data as DoneMessageT
    return onDone && onDone(d)
  } else if (data.request_id === request_id) {
    return onError && onError({ error: `Unknown type of response: ${JSON.stringify(data)}`, code: 500 })
  }
}

export async function websocket({
  request_id,
  host,
  onData,
  onDone,
  onError,
}: {
  request_id: string
  host: string
} & CallbacksT): Promise<WritebacksT> {
  const openConnection = async () => {
    if (!WSS || WSS?.readyState !== 1) {
      // open websocket connection to host/PE
      WSS = new WebSocket(`${host}/PE`)
      return new Promise((resolve) => {
        WSS.onopen = () => {
          resolve(true)
        }
      })
    }
  }
  const API: WritebacksT = {
    write: async (data): Promise<void> => {
      await openConnection()
      WSS.send(JSON.stringify(data))
    },
    close: async (): Promise<boolean> => {
      if (WSS) WSS.close()
      return true
    },
  }
  await openConnection()

  WSS.onmessage = (event) => {
    try {
      const data: ChannelMessageT["data"] = JSON.parse(event.data)
      processMessage({ request_id, data, onData, onDone, onError })
    } catch (error) {
      return { error }
    }
  }
  return API
}

export async function events({
  request_id,
  onData,
  onDone,
  onError,
}: { request_id: string } & CallbacksT): Promise<WritebacksT> {
  const API: WritebacksT = {
    write: async (data): Promise<void> => {
      const { router } = data.input
      EventBus.emit(`${router.id}:${router.path}:${router.method}`, data)
    },
    close: async (): Promise<boolean> => {
      // TODO: clean up event listeners
      return true
    },
  }

  // setup callbacks
  EventBus.on(request_id, async (data: ChannelMessageT["data"]) => {
    processMessage({ request_id, data, onData, onDone, onError })
  })

  return API
}

export async function eventsServer({ API }: { API: ServerAPIT }) {
  // setup event listener to register new modules
  EventBus.on("registerModule", async ({ module }: { module: z.infer<typeof ModuleS> }) => {
    const { code } = await API.registerModule({ module })
    if (code !== 200) return { error: `Failed to register module`, code }
    return { code }
  })

  // setup event listener to register new protocols
  EventBus.on("registerProtocol", async ({ protocol }: { protocol: z.infer<typeof BasePayloadS> }) => {
    // TODO
    return { code: 200 }
  })

  // setup event listeners to all modules paths
  for (const module of API.getModules()) {
    for (const path in module.schema.paths) {
      const path_obj = module.schema.paths[path]
      for (const method in path_obj) {
        EventBus.on(
          `${module.id}:${path}:${method}`,
          async ({
            input,
            globals,
            abort,
          }: {
            input: BasePayloadT
            abort?: boolean
            globals?: { [key: string]: any }
          }) => {
            // if it's an abort message, abort the request
            if (abort) return API.abort({ request_id: input.id })

            const response = await API.execute({
              input,
              globals,
              // ...channel,
              onData: (data) => {
                EventBus.emit(`${input.id}`, { request_id: input.id, data, status: "data" })
              },
              onDone: (data) => {
                EventBus.emit(`${input.id}`, { request_id: input.id, status: "complete", data })
              },
              onError: (err) => {
                EventBus.emit(`${input.id}`, { request_id: input.id, error: err, status: "error" })
              },
            })

            if (response && "error" in response)
              return EventBus.emit(`${input.id}`, { request_id: input.id, error: response?.error, status: "error" })
            // return response
            return response
          }
        )
      }
    }
  }
}
