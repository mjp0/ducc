import { ReceiptT, SignedTransactionT } from ".";
import { CallT, CallbacksT, ErrorT, UserT } from "./base";

export type RequestT = { user: UserT, call: CallT }

export type RequestAPIT = {
  request_id: string
  tx?: SignedTransactionT
  abort: () => Promise<void | ErrorT>
  setAbort: (abort_fn: () => Promise<void>) => Promise<void>
} & CallbacksT