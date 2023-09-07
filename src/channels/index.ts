import { ChannelMessageT, CallbacksT, DataMessageT, DoneMessageT } from "@/schemas";

export type ChannelT = {
  write: ({ msg, status }: { msg?: any; status: number }) => Promise<void>
  error: (err: any) => Promise<void>
  end: () => Promise<boolean>
}

export async function processMessage({ request_id, data, onData, onDone, onError }: ChannelMessageT & CallbacksT) {
  if ("error" in data) {
    return onError && onError(data)
  }
  // first response should be { request_id: "...", status: "ready" }
  if (data.request_id && data.status === "ready") {
    request_id = data.request_id
    return
  } else if (data.request_id === request_id && data.status === "data") {
    // all subsequent responses should be { request_id: "...", data: "..." }
    const d = data as DataMessageT
    return onData && onData(d)
  } else if (data.request_id === request_id && data.status === "complete") {
    const d = data as DoneMessageT
    return onDone && onDone(d)
  } else if (data.request_id === request_id) {
    return onError && onError({ error: `Unknown type of response: ${JSON.stringify(data)}`, code: 500 })
  }
}