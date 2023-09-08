import { ModuleT } from "@/schemas"
import { createChallenge } from "@/security"
import { debug } from "@/utils"
import { moduleGenerator } from ".."
import { z } from "zod"

const d = debug("module:ping")

export const pingModule = async(): Promise<ModuleT> => {
  const pingM = await moduleGenerator({
    id: "ping",
    desc: "ping module",
    version: "1.0.0",
  })

  pingM
    .addMethod({
      id: "ping",
      fn: async ({ onData, onError, onDone }) => {
        onDone && onDone({ result: 'pong' })
        return {
          abort: () => {},
        }
      },
      desc: "A pong for your ping",
      settings: { free: true },
    })
    .addOutput({
      code: 200,
      desc: "Returns a pong message",
      schema: z.object({
        result: z.string(),
      }),
    })
  return pingM.run()
}