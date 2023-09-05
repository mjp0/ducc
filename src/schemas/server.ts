import { z } from "zod"
import { ModuleS, BasePayloadT, CallbacksT, ErrorT } from "."

export type ServerAPIT = {
  getModules: () => z.infer<typeof ModuleS>[]
  execute: (data: { input: BasePayloadT; params?: any, globals?: any } & CallbacksT) => Promise<any>
  abort: (data: { request_id: string }) => Promise<boolean | void | ErrorT>
  registerModule: ({ module }: { module: z.infer<typeof ModuleS> }) => Promise<{ code: number } | ErrorT>
}
