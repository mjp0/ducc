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