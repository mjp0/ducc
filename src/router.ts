import {
  BasePayloadT,
  RequestAPIT,
  CallbacksT,
  ErrorT,
  ModuleT,
  DataMessageT,
  DoneMessageT,
  ReceiptS,
} from "@/schemas"
import { buf2hex, hex2buf, signMessage } from "@/security"
import { nanoid } from "nanoid"
import Enforcer from "openapi-enforcer"
import { varToByte } from "./utils"
import { walletModule } from "./modules/wallet"
import { asAPI } from "./modules"

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
  if (input.offer.call.module_id !== "handshake") REQUESTS[input.id] = true

  const { call } = input.offer
  const fn_name = call.method_id.replace("/", "")
  const module = MODULES.find(
    (module: ModuleT) =>
      module.id === call.module_id && module.schema.paths[`/${call.method_id}`] && module.fns[fn_name]
  )
  // TODO: else if(protocols[call]) process = protocols[call];
  if (!module) return request.onError({ error: `Unknown call ${call.module_id}`, code: 404 })
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
  console.log(`Executing ${call.module_id}:${call.method_id} / ${input.id}`)
  if (typeof fn === "function") {
    let streamed_bytes: number = 0
    const offerOnData = async (data: DataMessageT) => {
      const dat = data?.data
      if (dat) streamed_bytes += varToByte(dat)
      request?.onData && request.onData(data)
    }
    const offerOnDone = async (data: DoneMessageT) => {
      // TODO: charge and add receipt

      // create receipt
      const receipt: any = {
        id: nanoid(),
        user_id: input.meta.user_id,
        offer: input.offer,
        details: {
          input: {
            bytes: 0,
            tokens: 0,
          },
          output: {
            bytes: 0,
            tokens: 0,
          },
        },
        total_bytes: 0,
        total_tokens: 0,
      }

      let multiplier = 0
      // if there is a tx, charge the wallet
      if (input?.signed_transaction && input?.offer?.multiplier) {
        // compute charge
        let processed_bytes = streamed_bytes

        // if onDone receives data, use that as the final processed bytes
        if (data?.data) processed_bytes = varToByte(data?.data)

        // get the multiplier
        multiplier = module.fns[fn_name].settings?.multiplier || 0

        // if token_cost is zero or below, we have a problem because this is suppose to be a paid request
        if (multiplier <= 0) {
          // however, we can't cut the request because it's been processed already and this is most likely
          // a bug in the module settings, so notify the server owner
          // TODO: notify admin
        }

        // compute the final cost
        const params_bytes = varToByte(input.params || 0)
        receipt.details = {
          input: {
            bytes: params_bytes,
            tokens: params_bytes * multiplier,
          },
          output: {
            bytes: processed_bytes,
            tokens: multiplier * processed_bytes,
          },
        }
        receipt.total_tokens = receipt.details.input.tokens + receipt.details.output.tokens
        receipt.total_bytes = receipt.details.input.bytes + receipt.details.output.bytes

        // sign the receipt
        const signature = await signMessage(JSON.stringify(receipt), hex2buf({ input: globals.private_key }))
        receipt.sig = buf2hex({ input: signature })

        // ensure valid signature
        const parsed_receipt = ReceiptS.safeParse(receipt)
        if (!parsed_receipt.success) return request?.onError && request.onError({ error: "invalid receipt", code: 500 })

        data.receipt = parsed_receipt.data

        // charge the wallet
        const wallet = asAPI(await walletModule())
        try {
          const charge = await wallet.charge({
            receipt: data.receipt,
          })
        } catch (error: any) {
          return request?.onError && request.onError(error)
        }
      }

      request?.onDone && request.onDone(data)
    }

    const fn_api = (await fn({
      stripe: globals.stripe,
      ...input.params,
      user_id: input.meta.user_id,
      onData: offerOnData,
      onDone: offerOnDone,
      onError: request.onError,
    })) as any | ErrorT
    if (typeof fn_api === "object" && "error" in fn_api) return request.onError({ ...fn_api?.error })
    if (input.offer.id !== "handshake") REQUESTS[input.id] = fn_api
    return fn_api
  } else {
    // TODO: add support for fetching functions based on ids
    return request.onError({ error: `Unknown function ${input.offer.call.method_id}`, code: 404 })
  }
}
