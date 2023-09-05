import { z } from "zod"
import { ReceiptS, CostDetailsS, ErrorT } from "."

export const MessageS = z.object({
  request_id: z.string().nonempty(),
  msg: z.any().optional(),
  code: z.string().optional(),
  data: z.any().optional(),
})
export type MessageT = z.infer<typeof MessageS>

export const ReadyMessageS = MessageS.merge(
  z.object({
    status: z.literal("ready"),
  })
)
export type ReadyMessageT = z.infer<typeof ReadyMessageS>

export const DataMessageS = MessageS.merge(
  z.object({
    status: z.literal("data"),
  })
)
export type DataMessageT = z.infer<typeof DataMessageS>

export const DoneMessageS = MessageS.merge(
  z.object({
    receipt: ReceiptS,
    costs: CostDetailsS,
    status: z.literal("complete"),
  })
)
export type DoneMessageT = z.infer<typeof DoneMessageS>

export const ChallengeMessageS = MessageS.merge(
  z.object({
    status: z.literal("challenge"),
    data: z.object({
      challenge: z.string(),
    }),
  })
)
export type ChallengeMessageT = z.infer<typeof ChallengeMessageS>

export type ChannelMessageT = { request_id: string; data: ReadyMessageT | DataMessageT | DoneMessageT | ErrorT }