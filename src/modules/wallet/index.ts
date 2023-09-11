import { ModuleT, ModuleCallbacksT, ModuleFnAPIT, ReceiptS } from "@/schemas"
import { debug, timeout } from "@/utils"
import { moduleGenerator } from ".."
import { charge, getBalance, getStatus, getSubsidizedBalance } from "./ledger"
import { z } from "zod"

const d = debug("module:handshake")

export const walletModule = async(): Promise<ModuleT> => {
  const walletM = await moduleGenerator({
    id: "wallet",
    desc: "Wallet module",
    version: "1.0.0",
  })

  walletM
    .addMethod({
      id: "getStatus",
      desc: "Get wallet status",
      fn: async ({ onData, onError, onDone, user_id }) => {
        // fetch wallet status from ledger
        const status = await getStatus({ user_id })
        if (!status || "error" in status) return onError({ error: status?.error || "Unknown error", code: 500 })
        d(`fetched status ${status} for ${user_id}`)
        onDone({ result: status })
        return {
          abort: () => {},
        }
      },
    })
    .addInput({
      schema: z.object({
        user_id: z.string(),
      }),
    })
    .addOutput({
      code: 200,
      desc: "Returns wallet status",
      schema: z.object({
        result: z.string(),
      }),
    })

  walletM
    .addMethod({
      id: "getBalance",
      desc: "Get wallet balance",
      fn: async ({ onData, onError, onDone, user_id }) => {
        // fetch wallet balance from ledger
        const balance = await getBalance({ user_id })
        if (typeof balance === undefined || (typeof balance === "object" && "error" in balance))
          return onError({ error: balance?.error || "Unknown error", code: 500 })
        d(`fetched balance ${balance} for ${user_id}`)
        onDone({ result: balance })
        return {
          abort: () => {},
        }
      },
    })
    .addInput({
      schema: z.object({
        user_id: z.string(),
      }),
    })
    .addOutput({
      code: 200,
      desc: "Returns wallet balance",
      schema: z.object({
        result: z.number(),
      }),
    })

  walletM
    .addMethod({
      id: "getSubsidizedBalance",
      desc: "Get wallet's subsidized credits",
      fn: async ({ onData, onError, onDone, user_id }) => {
        // fetch wallet balance from ledger
        const balance = await getSubsidizedBalance({ user_id })
        if (!balance || "error" in balance) return onError({ error: balance?.error || "Unknown error", code: 500 })
        d(`fetched subsidized balance ${balance} for ${user_id}`)
        onDone({ result: balance })
        return {
          abort: () => {},
        }
      },
    })
    .addInput({
      schema: z.object({
        user_id: z.string(),
      }),
    })
    .addOutput({
      code: 200,
      desc: "Returns wallet's subsidized credits",
      schema: z.object({
        result: z.number(),
      }),
    })

  walletM
    .addMethod({
      id: "charge",
      desc: "Charge wallet",
      fn: async ({ onData, onError, onDone, receipt }) => {
        // fetch wallet balance from ledger
        const res = await charge({ receipt })
        if (res && "error" in res) return onError({ error: res.error, code: 500 })
        d(`charged wallet ${receipt.user_id} with ${receipt.amount}`)
        onDone({ result: res.body })
        return {
          abort: () => {},
        }
      },
    })
    .addInput({
      schema: z.object({
        receipt: ReceiptS,
      }),
    })
    .addOutput({
      code: 200,
      desc: "Charge wallet",
      schema: z.object({
        result: z.number(),
      }),
    })
  return walletM.run()
}
