import { expect, test } from "vitest"
import { Server, Client } from "../src"
import { keyPair } from "../src/security"
import { mathModule } from "../src/modules/example/math"
import { ReceiptS } from "../src/schemas"

const keypair = await keyPair()
const user = {
  ...keypair,
  user_id: keypair.public_key,
}

// start local server
const client = await Client({
  type: "events",
  host: "localhost",
  server_modules: [mathModule]
})
if ("error" in client) throw new Error(client.error)

test("tests multiple module functions", async () => {
  // create both requests first to see they stay separate
  const request_sum = await client.request({
    user,
    module_id: "math",
    method_id: "sum",
    params: {
      a: 1,
      b: 2,
    },
  })

  const request_mul = await client.request({
    user,
    module_id: "math",
    method_id: "multiply",
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
})

test("tests streaming a request", async () => {
  const request_str = await client.request({
    user,
    module_id: "math",
    method_id: "stream_test",
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
    module_id: "math",
    method_id: "stream_test",
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
  expect(str_seq).toStrictEqual([1, 2])
  expect(result_str?.error).toBe("cancelled")
})

test("tests accepting payments for a request", async () => {
  const user = {
    private_key: "ae01f213da1b19876442a23925bd0752ef247406b0b253aec5bb01c4c3c3285e",
    public_key: "039955d31862f529349abafe3829a18160b5ba3dccfb185c0041ba9f5883af5f2c",
    user_id: "039955d31862f529349abafe3829a18160b5ba3dccfb185c0041ba9f5883af5f2c",
  }
  const server = await Server({ modules: [mathModule] })
  const client = await Client({
    type: "events",
  })
  if ("error" in client) throw new Error(client.error)

  const request_str = await client.request({
    user,
    module_id: "math",
    method_id: "divide",
    params: {
      a: 2,
      b: 2,
    },
    tx: {
      max_spent: 0.01,
    }
  })
  if ("error" in request_str) throw new Error(request_str.error)

  const divide_res = new Promise(async (resolve, reject) => {
    await client.compute({
      request: request_str,
      onDone: (data) => {
        resolve(data)
      },
      onError: ({ error }) => {
        throw new Error(error)
      },
    })
  })
  const result_str: any = await Promise.resolve(divide_res)
  expect(ReceiptS.safeParse(result_str?.data.receipt).success).toBeTruthy()
  expect(result_str?.data.result).toBe(1)
})//, { timeout: 100000 })
