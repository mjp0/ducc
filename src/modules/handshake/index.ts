import { ModuleT, ModuleCallbacksT, ModuleFnAPIT } from "@/schemas"
import { createChallenge } from "@/security"
import { debug } from "@/utils"
import { moduleGenerator } from ".."
import { z } from "zod"

const d = debug("module:handshake")

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

export const handshakeModule = await handshakeM.run()

/* 
export const _handshakeModule: ModuleT = {
  id: "handshake",
  fns: {
    challenge: async ({
      onData,
      onError,
      onDone,
      request_id,
      ip
    }: ModuleCallbacksT & { request_id: string; ip: string }): Promise<ModuleFnAPIT> => {
      const challenge = await createChallenge({ request_id, ip: ip || "localhost" })
        d(`generated challenge ${challenge} for ${request_id}`)
      onDone({ request_id, status: "challenge", data: { result: challenge } })
        return {
        abort: () => {},
      }
    },
  },

  schema: {
    info: {
      description: "Handshake module",
      version: "1.0.0",
    },
    paths: {
      "/challenge": {
        post: {
          summary: "Generate security challenge",
          operationId: "challenge",
          tags: ["free=true"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    request_id: { type: "string" },
                    ip: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Returns a random nonce for signing",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      result: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {},
    },
  },
}
 */
