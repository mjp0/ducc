import { z } from "zod"
import EventBus from "@/channels/events"
import {
  BasePayloadT,
  CallbacksT,
  ChannelMessageT,
  WritebacksT,
  ModuleS,
  BasePayloadS,
} from "@/schemas"
import { ServerAPIT } from "@/schemas/server"
import { processMessage } from "."

export async function events({
  request_id,
  onData,
  onDone,
  onError,
}: { request_id: string } & CallbacksT): Promise<WritebacksT> {
  const API: WritebacksT = {
    write: async (data): Promise<void> => {
      const { offer } = data.input
      EventBus.emit(`${offer.call.module_id}:/${offer.call.method_id}:post`, data)
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
