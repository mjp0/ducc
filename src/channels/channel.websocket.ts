import {
  BasePayloadT,
  CallbacksT,
  ChannelMessageT,
  WritebacksT,
  ServerAPIT,
} from "@/schemas"
import { processMessage } from "."
import WebSocket, { WebSocketServer } from "ws"
import b4a from "b4a"

const WSSCache = new Map()

export async function websocket({
  request_id,
  host,
  onData,
  onDone,
  onError,
}: {
  request_id: string
  host: string
} & CallbacksT): Promise<WritebacksT> {
  const openConnection = async () => {
    const WSS = WSSCache.get(host)
    if (!WSS || WSS?.readyState !== 1) {
      // open websocket connection to host/PE
      const WSS = new WebSocket(`ws://${host}:8080`)
      WSSCache.set(host, WSS)
      return new Promise((resolve) => {
        WSS.onopen = () => {
          resolve(WSS)
        }
      })
    }
    return WSS
  }
  const API: WritebacksT = {
    write: async (data): Promise<void> => {
      const WSS = (await openConnection()) as WebSocket
      WSS.send(JSON.stringify(data))
    },
    close: async (): Promise<boolean> => {
      const WSS = (await openConnection()) as WebSocket
      if (WSS) {
        WSS.close()
        WSSCache.delete(host)
      }
      return true
    },
  }
  const WSS = (await openConnection()) as WebSocket

  WSS.onmessage = (event) => {
    try {
      if (b4a.isBuffer(event?.data)) return { error: "buffer not supported yet " }
      const data: ChannelMessageT["data"] = typeof event.data === "object" ? event.data : JSON.parse(event.data)
      processMessage({ request_id, data, onData, onDone, onError })
    } catch (error) {
      return { error }
    }
  }
  return API
}

async function handleMessage({
  API,
  ws,
  input,
  globals,
  abort,
}: {
  API: ServerAPIT
  ws: WebSocket
  input: BasePayloadT
  abort?: boolean
  globals?: { [key: string]: any }
}) {
  // if it's an abort message, abort the request
  if (abort) return API.abort({ request_id: input.id })

  const response = await API.execute({
    input,
    globals,
    // ...channel,
    onData: (data) => {
      ws.send(JSON.stringify({ request_id: input.id, data, status: "data" }))
    },
    onDone: (data) => {
      ws.send(JSON.stringify({ request_id: input.id, status: "complete", data }))
    },
    onError: (err) => {
      ws.send(JSON.stringify({ request_id: input.id, error: err, status: "error" }))
    },
  })

  if (response && "error" in response)
    return ws.send(JSON.stringify({ request_id: input.id, error: response?.error, status: "error" }))
  // return response
  return response
}

export async function websocketServer({
  API,
  host = "127.0.0.1",
  port = 8080,
}: {
  API: ServerAPIT
  host?: string
  port?: number
}) {
  // start websocket server
  const wss = new WebSocketServer({ host, port })

  wss.on("connection", function connection(ws) {
    ws.on("error", console.error)

    ws.on("message", function message(data) {
      const d: string = b4a.isBuffer(data) ? b4a.toString(data) : (typeof data === 'string' ? data : '{}')
      let dat: ChannelMessageT["data"] = JSON.parse(d)
      handleMessage({ ...dat, ws, API } as any)
    })
  })
}
