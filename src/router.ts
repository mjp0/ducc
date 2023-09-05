import { BasePayloadT, RequestAPIT, CallbacksT, ErrorT, ModuleT, DataMessageT, DoneMessageT } from "@/schemas"
import { verifyAuth } from "@/security"
import { nanoid } from "nanoid"
import Enforcer from "openapi-enforcer"
import { varToByte } from "./utils"

export async function router<T>({
  input,
  globals,
  request,
}: {
  input: BasePayloadT & { params: T }
  globals: {
    MODULES: ModuleT[]
    PROTOCOLS: any
    REQUESTS: { [key: string]: RequestAPIT | boolean }
    [key: string]: any
  }
  request: RequestAPIT
} & CallbacksT): Promise<any> {
  const { MODULES, PROTOCOLS, REQUESTS } = globals

  // TODO: improve this because now each request can have only one call which makes protocols more difficult
  if (REQUESTS[input.id]) return
  // reserve the request id in case multiple calls are made (exclude handshakes)
  if (input.router.id !== "handshake") REQUESTS[input.id] = true

  const { router } = input
  const fn_name = router.path.replace("/", "")
  const module = MODULES.find(
    (module: ModuleT) => module.id === router.id && module.schema.paths[router.path] && module.fns[fn_name]
  )
  // TODO: else if(protocols[call]) process = protocols[call];
  if (!module) return request.onError({ error: `Unknown call ${router.id}`, code: 404 })
  if (typeof module.fns[fn_name]?.fn !== "function")
    return request.onError({ error: `Function id references are not supported yet`, code: 404 })

  // check if the module schema is valid
  const sch = {
    openapi: "3.0.0",
    ...module.schema,
  }
  sch.info.title = module.id

  const [api, error, warning] = await Enforcer(sch, {
    fullResult: true,
  })
  if (error) return request.onError({ error: error.message(), code: 500 })
  if (warning) console.warn(warning.message)

  const fn = module.fns[fn_name].fn
  console.log(`Executing ${router.id}:${router.path} / ${input.id}`)
  if (typeof fn === "function") {
    let streamed_bytes: number = 0
    const fnOnData = async (data: DataMessageT) => {
      const dat = data?.data
      if (dat) streamed_bytes += varToByte(dat)
      request?.onData && request.onData(data)
    }
    const fnOnDone = async (data: DoneMessageT) => {
      // TODO: charge and add receipt
      // fake data
      if (data.status === "complete") {
        let token_cost = 0
        // if there is a tx, charge the wallet
        if (input?.signed_transaction) {
          // compute charge
          let processed_bytes = streamed_bytes

          if (data?.data) processed_bytes = varToByte(data?.data)

          token_cost = module.fns[fn_name].settings?.multiplier || 0

          // charge the wallet
          // const charge = await charge({ tx })
          // if ("error" in charge) return onError(charge)
          // data.receipt = charge.receipt
        }

        data.receipt = {
          receipt_id: nanoid(),
          call: input.router,
          cost_usd: token_cost || 0,
          details: {
            input: {
              tokens: 0,
              cost_usd: 0,
            },
            output: {
              tokens: 0,
              cost_usd: 0,
            },
          },
        }
      }
      request?.onDone && request.onDone(data)
    }

    const fn_api = (await fn({
      stripe: globals.stripe,
      ...input.params,
      user_id: input.meta.user_id,
      onData: fnOnData,
      onDone: fnOnDone,
      onError: request.onError,
    })) as any | ErrorT
    if (typeof fn_api === "object" && "error" in fn_api) return request.onError({ ...fn_api?.error })
    if (input.router.id !== "handshake") REQUESTS[input.id] = fn_api
    return fn_api
  } else {
    // TODO: add support for fetching functions based on ids
    return request.onError({ error: `Unknown function ${router.id}`, code: 404 })
  }
}
