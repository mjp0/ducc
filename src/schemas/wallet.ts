import { z } from "zod"
import { SignatureS, CallS, CallT, CallbacksT, ErrorT } from "./"

// WALLET
export type WalletT = {
  env?: any
  user_id: string
  ipv4?: string
}

export type WalletAPIT = {
  getStatus: () => Promise<{ error?: string; success?: boolean; status?: string }>
  getBalance: () => Promise<{ error?: string; success?: boolean; balance?: number }>
  getFreeBalance: () => Promise<{ error?: string; success?: boolean; balance?: number; accounts?: number }>
  charge: (params: ReceiptT & { call_id: string }) => Promise<{ error?: any; success?: boolean }>
  suspend: () => Promise<{ error?: string; success?: boolean }>
  isSuspened: () => Promise<{ error?: string; success?: boolean; suspended?: boolean }>
}

export const CostDetailsS = z.object({
  input: z.object({
    tokens: z.number(),
    cost_usd: z.number(),
  }),
  output: z.object({
    tokens: z.number(),
    cost_usd: z.number(),
  }),
})
export type CostDetailsT = z.infer<typeof CostDetailsS>

export const ReceiptS = z.object({
  receipt_id: z.string(),
  cost_usd: z.number(),
  details: CostDetailsS,
  call: CallS,
})
export type ReceiptT = z.infer<typeof ReceiptS>

