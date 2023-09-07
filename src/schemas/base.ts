import { z } from "zod"
import { ChallengeMessageT, DataMessageT, DoneMessageT } from "."

// TYPES
export type Hex = Uint8Array | string

export type ErrorT = {
  error: string
  code: number
  meta?: any
}

export const UserS = z.object({
  user_id: z.string().nonempty(),
  public_key: z.string().nonempty(),
  private_key: z.string().nonempty(),
})
export type UserT = z.infer<typeof UserS>

export const CallS = z.object({
  id: z.string().nonempty(),
  path: z.string().nonempty().catch("/"),
  method: z.string().nonempty().catch("post"),
})
export type CallT = z.infer<typeof CallS>

export const SignatureS = z.object({
  n: z.string().optional(),
  c: z.string(),
  s: z.string(),
  pk: z.string(),
})
export type SignatureT = z.infer<typeof SignatureS>

export const RequestCallS = z.object({
  module_id: z.string().nonempty(),
  method_id: z.string().nonempty(),
})
export type RequestCallT = z.infer<typeof RequestCallS>

export const OfferS = z.object({
  id: z.string().nonempty(),
  call: RequestCallS,
  multiplier: z.number().nonnegative().optional(),
  sig: SignatureS,
})
export type OfferT = z.infer<typeof OfferS>

export const SignedTransactionS = z.object({
  max_spent: z.number().nonnegative(),
  signature: SignatureS,
})

export type SignedTransactionT = z.infer<typeof SignedTransactionS>

export const BasePayloadS = z.object({
  id: z.string().nonempty(),
  meta: z.object({
    user_id: z.string().nonempty(),
  }),
  auth: SignatureS,
  offer: OfferS,
  params: z.any().optional(),
  signed_transaction: SignedTransactionS.optional(),
  abort: z.boolean().optional(),
})
export type BasePayloadT = z.infer<typeof BasePayloadS>

export const BaseloadWithAuthS = BasePayloadS.merge(
  z.object({
    auth: SignatureS,
  })
)

export type CallbacksT = {
  onData?: (data: DataMessageT) => void
  onDone: (data: DoneMessageT | ChallengeMessageT) => void
  onError: (err: ErrorT) => void
}

export type ModuleCallbacksT = {
  onData: (data: any) => void
  onDone: (data: any) => void
  onError: (err: ErrorT) => void
}

export type ModuleFnAPIT = { abort?: Function } | void

export type WritebacksT = {
  write: (data: { input: BasePayloadT; abort?: boolean } & { [key in string]: any }) => void
  close: () => void
}

export type ClientAPIT = {
  request: (data: {
    user: UserT
    params?: any
    offer: OfferT
    tx?: { max_spent: number }
  }) => Promise<BasePayloadT | ErrorT>
  compute: (data: CallbacksT & { request: BasePayloadT }) => Promise<ComputeT | ErrorT>
}

export type ComputeT = {
  abort: () => void
}
