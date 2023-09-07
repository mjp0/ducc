import { afterAll, afterEach, beforeAll, expect, test } from "vitest"
import { Server, Client } from "../src"
import { keyPair } from "../src/security"
import { mathModule } from "../src/modules/example/math"
import { ReceiptS, SignedTransactionT } from "../src/schemas"
import { setupServer } from 'msw/node'
import { rest } from 'msw'

// Generate user keys
const keypair = await keyPair()
const user = {
  ...keypair,
  user_id: keypair.public_key,
}

// Setup mockup wallet server
export const restHandlers = [
  rest.post('https://wallet.promptc0.com/charge', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ result: 1 }))
  }),
  rest.post('https://wallet.promptc0.com/getBalance', async (req, res, ctx) => {
    const b: { user_id: string } = await req.json()
    if(b.user_id === '02f6681a65435cdee1c381fa0378ca2aaec49d40098bd517afebac230af68d6707') {
      // return 0  
      return res(ctx.status(200), ctx.json({ result: 0 }))
    }
    return res(ctx.status(200), ctx.json({ result: 123 }))
  }),
]

const wallet_server = setupServer(...restHandlers)
let server
let client

// Start server before all tests
beforeAll(async () => {
  wallet_server.listen({ onUnhandledRequest: 'bypass' })

  const server_owner = {
    private_key: "19f7ee8c6587b80042e5065be11500e03585d0dec7d5fd90b9cba3a93e9914ee",
    public_key: "03c426ab58c9257cffc6c2f1acbc8bde5d9bb343be8ff7c6426f08310c9f26d9de",
    user_id: "03c426ab58c9257cffc6c2f1acbc8bde5d9bb343be8ff7c6426f08310c9f26d9de",
  }
  
  server = await Server({ modules: [mathModule], private_key: server_owner.private_key, type: "websocket" })

  client = await Client({
    type: "websocket",
    host: "127.0.0.1",
  })
  if ("error" in client) throw new Error(client.error)
})

//  Close server after all tests
afterAll(() => wallet_server.close())

// Reset handlers after each test `important for test isolation`
afterEach(() => wallet_server.resetHandlers())

// Setup PEA server

test("tests multiple module functions", async () => {
  
  // create both requests first to see they stay separate
  const request_sum = await client.request({
    user,
    offer: await server.signOffer({
      call: {
        module_id: "math",
        method_id: "sum",
      },
    }),
    params: {
      a: 1,
      b: 2,
    },
  })

  const request_mul = await client.request({
    user,
    offer: await server.signOffer({
      call: {
        module_id: "math",
        method_id: "multiply",
      },
    }),
    params: {
      a: 1,
      b: 2,
    },
  })

  // compute both
  const compute_sum = new Promise((resolve, reject) => {
    client.compute({
      request: request_sum,
      onData: (data) => {
        expect(data?.data?.result).toBe(3)
      },
      onDone: (data) => {
        resolve(data)
      },
      onError: ({ error }) => {
        console.log(error)
        reject(error)
        throw new Error(error)
      },
    })
  })
  const result_sum: any = await Promise.resolve(compute_sum)
  expect(result_sum?.data.result).toBe(3)

  const compute_mul = new Promise((resolve, reject) => {
    client.compute({
      request: request_mul,
      onData: (data) => {
        expect(data?.data?.result).toBe(2)
      },
      onDone: (data) => {
        resolve(data)
      },
      onError: ({ error }) => {
        console.log(error)
        reject(error)
        throw new Error(error)
      },
    })
  })
  const result_mul: any = await Promise.resolve(compute_mul)
  expect(result_mul?.data.result).toBe(2)
}, { timeout: 1000000 })

test("tests streaming a request", async () => {
  const request_str = await client.request({
    user,
    offer: await server.signOffer({
      call: {
        module_id: "math",
        method_id: "stream_test",
      },
    }),
  })

  const str_seq: number[] = []
  const compute_str = new Promise((resolve, reject) => {
    client.compute({
      request: request_str,
      onData: (data) => {
        str_seq.push(data?.data?.result)
      },
      onDone: (data) => {
        resolve(data)
      },
      onError: ({ error }) => {
        console.log(error)
        reject(error)
        throw new Error(error)
      },
    })
  })
  const result_str: any = await Promise.resolve(compute_str)
  expect(str_seq).toStrictEqual([1, 2, 3])
  expect(result_str?.data.result).toBe(3)
})

test("tests aborting a request", async () => {
  const request_str = await client.request({
    user,
    offer: await server.signOffer({
      call: {
        module_id: "math",
        method_id: "stream_test",
      },
    }),
  })

  const str_seq: number[] = []
  const compute_str = new Promise(async (resolve, reject) => {
    const c = await client.compute({
      request: request_str,
      onData: (data) => {
        str_seq.push(data?.data?.result)
        "abort" in c && c.abort()
      },
      onDone: (data) => {
        resolve(data)
      },
      onError: ({ error }) => {
        resolve(error)
      },
    })
  })
  const result_str: any = await Promise.resolve(compute_str)
  expect(str_seq).toStrictEqual([1])
  expect(result_str?.error).toBe("cancelled")
}, { timeout: 100000 })

test("tests accepting payments for a request", async (done) => {
  const user = {
    private_key: "ae01f213da1b19876442a23925bd0752ef247406b0b253aec5bb01c4c3c3285e",
    public_key: "039955d31862f529349abafe3829a18160b5ba3dccfb185c0041ba9f5883af5f2c",
    user_id: "039955d31862f529349abafe3829a18160b5ba3dccfb185c0041ba9f5883af5f2c",
  }

  const request_str = await client.request({
    user,
    offer: await server.signOffer({
      call: {
        module_id: "math",
        method_id: "divide",
      },
      multiplier: 0.000000000000107147
    }),
    params: {
      a: 2,
      b: 2,
    },
    tx: {
      max_spent: 0.01,
    },
  })
  if ("error" in request_str) throw new Error(request_str.error)

  const divide_res = new Promise(async (resolve, reject) => {
    await client.compute({
      request: request_str,
      onDone: resolve,
      onError: reject,
    })
  }).catch((error) => {
    expect(error?.error).toBeFalsy()
  })
  const result_str: any = await Promise.resolve(divide_res)
  expect(ReceiptS.safeParse(result_str?.data.receipt).success).toBeTruthy()
  expect(result_str?.data.result).toBe(1)
})

test("tests failing payments when no balance", async (done) => {
  const user = {
    private_key: "f9f64ffb2583c082c3c523907c832b8d6e23c07fda996c6d21b740d826b962de",
    public_key: "02f6681a65435cdee1c381fa0378ca2aaec49d40098bd517afebac230af68d6707",
    user_id: "02f6681a65435cdee1c381fa0378ca2aaec49d40098bd517afebac230af68d6707",
  }

  const request_str = await client.request({
    user,
    offer: await server.signOffer({
      call: {
        module_id: "math",
        method_id: "divide",
      },
      multiplier: 0.000000000000107147
    }),
    params: {
      a: 2,
      b: 2,
    },
    tx: {
      max_spent: 0.01,
    },
  })
  if ("error" in request_str) throw new Error(request_str.error)

  const divide_res = new Promise(async (resolve, reject) => {
    await client.compute({
      request: request_str,
      onDone: resolve,
      onError: reject,
    })
  }).catch((error) => {
    expect(error?.error).toEqual("Insufficient balance")
  })
  const result_str: any = await Promise.resolve(divide_res)
  expect(ReceiptS.safeParse(result_str?.data.receipt).success).toBeFalsy()
  expect(result_str?.data.result).toBeUndefined()
})
