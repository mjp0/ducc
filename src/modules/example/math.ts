import { ModuleT, ModuleCallbacksT, ModuleFnAPIT } from "@/schemas"
import { moduleGenerator } from ".."
import { z } from "zod"

const mathM = await moduleGenerator({
  id: "math",
  desc: "Math module",
  version: "1.0.0",
})

mathM
  .addMethod({
    id: "sum",
    fn: async ({ onData, onError, onDone, a, b }) => {
      const result = a + b
      onData &&
        onData({
          result,
        }) // just for the sake of testing
      onDone && onDone({ result })
      return {
        abort: () => {},
      }
    },
    desc: "Adds two numbers",
    settings: { free: true },
  })
  .addInput({
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  })
  .addOutput({
    code: 200,
    desc: "Returns the sum of two numbers",
    schema: z.object({
      result: z.number(),
    }),
  })

mathM
  .addMethod({
    id: "multiply",
    fn: async ({ onData, onError, onDone, a, b }) => {
      const result = a * b
      onData &&
        onData({
          result,
        }) // just for the sake of testing
      onDone && onDone({ result })
      return {
        abort: () => {},
      }
    },
    desc: "Multiplies two numbers",
    settings: { free: true },
  })
  .addInput({
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  })
  .addOutput({
    code: 200,
    desc: "Returns the multiplication of two numbers",
    schema: z.object({
      result: z.number(),
    }),
  })

mathM
  .addMethod({
    id: "stream_test",
    fn: async ({ onData, onError, onDone }) => {
      let cancelled = false
      let n: number = 0
      const up = function (n: number) {
        if (cancelled) return
        n++
        onData &&
          onData({
            result: n,
          }) // just for the sake of testing
        if (n === 3) {
          return onDone && onDone({ result: n })
        } else {
          setTimeout(() => up(n), 500)
        }
      }
      up(n)

      return {
        abort: () => {
          cancelled = true
          onError && onError({ error: "cancelled", code: 400 })
          return true
        },
      }
    },
    desc: "Streams numbers",
    settings: { free: true },
  })
  .addOutput({
    code: 200,
    desc: "Streams numbers",
    schema: z.object({
      result: z.number(),
    }),
  })

mathM
  .addMethod({
    id: "divide",
    fn: async ({ onData, onError, onDone, a, b }) => {
      const result = a / b
      onDone && onDone({ result })
      return {
        abort: () => {},
      }
    },
    desc: "Divides two numbers",
  })
  .setMultiplier({ multiplier: 0.000000000000107147 })
  .addInput({
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  })
  .addOutput({
    code: 200,
    desc: "Returns the division of two numbers",
    schema: z.object({
      result: z.number(),
    }),
  })

export const mathModule = await mathM.run()

/* 
export const _mathModule: ModuleT = {
  id: "math",
  fns: {
    sum: async ({
      onData,
      onError,
      onDone,
      a,
      b,
    }: ModuleCallbacksT & { a: number; b: number }): Promise<ModuleFnAPIT> => {
      const result = a + b
      onData &&
        onData({
          result,
        }) // just for the sake of testing
      onDone && onDone({ result })
      return {
        abort: () => {},
      }
    },
    multiply: async ({
      onData,
      onError,
      onDone,
      a,
      b,
    }: ModuleCallbacksT & { a: number; b: number }): Promise<ModuleFnAPIT> => {
      const result = a * b
      onData &&
        onData({
          result,
        }) // just for the sake of testing
      onDone && onDone({ result })
      return {
        abort: () => {},
      }
    },
    stream_test: async ({ onData, onError, onDone }: ModuleCallbacksT): Promise<ModuleFnAPIT> => {
      let cancelled = false
      let n: number = 0
      const up = function (n: number) {
        if (cancelled) return
        n++
        onData &&
          onData({
            result: n,
          }) // just for the sake of testing
        if (n === 3) {
          return onDone && onDone({ result: n })
        } else {
          setTimeout(() => up(n), 500)
        }
      }
      up(n)

      return {
        abort: () => {
          cancelled = true
          onError && onError({ error: "cancelled", code: 400 })
          return true
        },
      }
    },
    divide: async ({
      onData,
      onError,
      onDone,
      a,
      b,
    }: ModuleCallbacksT & { a: number; b: number }): Promise<ModuleFnAPIT> => {
      const result = a / b
      onDone && onDone({ result })
      return {
        abort: () => {},
      }
    },
  },

  schema: {
    info: {
      description: "Math module",
      version: "1.0.0",
    },
    paths: {
      "/sum": {
        post: {
          summary: "Adds two numbers",
          operationId: "sum",
          tags: ["free=true"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    a: { type: "number" },
                    b: { type: "number" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Returns the sum of two numbers",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      result: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/multiply": {
        post: {
          summary: "Multiplies two numbers",
          operationId: "multiply",
          tags: ["free=true"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    a: { type: "number" },
                    b: { type: "number" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Returns the multiplication of two numbers",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      result: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/stream_test": {
        post: {
          summary: "Streams numbers",
          operationId: "stream_test",
          tags: ["free=true"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {},
                },
              },
            },
          },
          responses: {
            200: {
              description: "Streams numbers",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      result: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/divide": {
        post: {
          summary: "Divides two numbers",
          operationId: "divide",
          tags: ["multiplier=1.5"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    a: { type: "number" },
                    b: { type: "number" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Returns the division of two numbers",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      result: { type: "number" },
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
