import { nanoid } from "nanoid"
import { RequestAPIT, CallbacksT, CallT, RequestCallT, SignedTransactionT } from "@/schemas"
import _ from "lodash"

export async function Request<T>({
  tx,
  onData: _onData,
  onDone: _onDone,
  onError: _onError,
  request_id,
  method_id,
  module_id,
}: {
  request_id: string
  tx?: SignedTransactionT
} & RequestCallT &
  CallbacksT): Promise<RequestAPIT> {
  /* const _ = {
    logCall: async () => {},
  } */

  // set defaults
  const call: CallT = {
    method: "post",
    path: method_id || "/",
    id: module_id,
  }

  const callbacks: CallbacksT = {
    onData: async (data): Promise<void> => {
      _onData && _onData(data)
    },
    onDone: async (data): Promise<void> => {

      _onDone && _onDone(data)
    },
    onError: async (data: any): Promise<void> => {
      _onError && _onError(data)
    },
  }

  const API: RequestAPIT = {
    request_id,
    tx,
    abort: async (): Promise<void> => {},
    setAbort: async (abort_fn: () => Promise<void>): Promise<void> => {
      API.abort = abort_fn
    },
    ...callbacks,
  }

  return API
}
