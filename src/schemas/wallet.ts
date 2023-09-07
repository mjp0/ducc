import { z } from "zod"
import { SignatureS, CallS, CallT, CallbacksT, ErrorT, OfferS } from "./"

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
    bytes: z.number(),
  }),
  output: z.object({
    tokens: z.number(),
    bytes: z.number(),
  }),
})
export type CostDetailsT = z.infer<typeof CostDetailsS>

export const ReceiptS = z.object({
  id: z.string(),
  user_id: z.string(),
  details: CostDetailsS,
  total_bytes: z.number(),
  total_tokens: z.number(),
  offer: OfferS,
  sig: z.string()
})
export type ReceiptT = z.infer<typeof ReceiptS>

