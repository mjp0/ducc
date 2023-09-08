import { ModuleT } from "@/schemas"
import { createChallenge } from "@/security"
import { debug } from "@/utils"
import { moduleGenerator } from ".."
import { z } from "zod"

const d = debug("module:handshake")

export const handshakeModule = async(): Promise<ModuleT> => {
  const handshakeM = await moduleGenerator({
    id: "handshake",
    desc: "Handshake module",
    version: "1.0.0",
  })

  handshakeM
    .addMethod({
      id: "challenge",
      fn: async ({ onData, onError, onDone, request_id, ip }) => {
        const challenge = await createChallenge({ request_id, ip: ip || "localhost" })
        d(`generated challenge ${challenge} for ${request_id}`)
        onDone && onDone({ result: challenge })
        return {
          abort: () => {},
        }
      },
      desc: "Generate security challenge",
      settings: { free: true },
    })
    .addInput({
      schema: z.object({
        request_id: z.string(),
        ip: z.string(),
      }),
    })
    .addOutput({
      code: 200,
      desc: "Returns a random nonce for signing",
      schema: z.object({
        result: z.string(),
      }),
    })
  return handshakeM.run()
}