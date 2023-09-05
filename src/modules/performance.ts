import { Bench } from "tinybench"
import { mathModule } from "./example/math"
import _ from "lodash"
import { varToByte } from "@/utils";

const compute = async ({ fn, dataset }: { fn: Function; dataset: any[] }) => {
  const d = dataset.map((params) => {
    const size = varToByte(params)
    return { params, size }
  })
  const avg_size = _.meanBy(d, "size")
  const bench = new Bench({ time: d.length })
  const t = bench.add("module", async () => {
    await fn(d.pop()?.params)
  })

  await bench.run()
  return {
    time_per_run_ms: t.results[0]?.period as number,
    avg_size,
  }
}

export async function computePriceMultiplier({
  cost_per_month,
  margin_percentage,
  fn,
  dataset,
}: {
  cost_per_month: number
  margin_percentage: number
  fn: Function
  dataset: any[]
}) {
  if (cost_per_month < 0 || margin_percentage < 0)
    return { error: "cost_per_month and margin_percentage must be positive" }

  const { time_per_run_ms, avg_size } = await compute({
    fn,
    dataset,
  })

  // time consumed
  const time_per_byte = time_per_run_ms / avg_size
  const bytes_per_min = 60000 / time_per_byte

  // compute pricing
  const breakeven_bytes_per_month = bytes_per_min * 60 * 24 * 30
  const cost_per_byte = cost_per_month / breakeven_bytes_per_month

  // compute token multiplier per byte with profit
  const token_multiplier_per_byte_w_profit = cost_per_byte * (1 + margin_percentage / 100)

  // sanity check
  const sanity_check = Math.abs(cost_per_month - cost_per_byte * breakeven_bytes_per_month) < 0.00001
  if (!sanity_check) {
    return { error: "Sanity check failed: multiplier does not match cost_per_month assuming 100% usage" }
  }

  return {
    avg_size,
    time_per_byte,
    bytes_per_min,
    breakeven_bytes_per_month,
    cost_per_byte,
    token_multiplier_per_byte_w_profit,
  }
}

/*
  
# About datasets
  Dataset needs to be in a format that represents the final bytes. For example, with LLMs, have the dataset as "tokens" because
  that represents the actual byte amount of data the function processes. If you test LLM with plain text, your multiplier will be off because
  tokens don't map 1:1 with bytes. A Chinese word that is 15 bytes in character can take 5 tokens, while a popular
  English word that is 21 bytes can be 1 token. So, as a rule of thumb, if your function arguments are characters or pixels, you might need to 
  convert your data.

*/

const result =
  await computePriceMultiplier({
    cost_per_month: 10,
    margin_percentage: 20,
    fn: mathModule.fns.divide,
    dataset: _.times(1000, function () {
      return [
        {
          a: _.random(0, 1000000000000000000000000000000000000000000000000000000000000),
          b: _.random(0, 1000000000000000000000000000000000000000000000000000000000000),
        },
      ]
    }),
  })
if(result && 'error' in result) throw new Error(result.error)
const { avg_size, time_per_byte, bytes_per_min, breakeven_bytes_per_month, cost_per_byte, token_multiplier_per_byte_w_profit } = result
console.log(`Avg params (in bytes): ${avg_size}`)
console.log(`Time per byte: ${time_per_byte.toFixed(6)} ms`)
console.log(`Bytes per minute: ${bytes_per_min.toFixed(0)}`)
console.log(`Breakeven bytes per month: ${breakeven_bytes_per_month.toFixed(0)}`)
console.log(`Token multiplier per byte: ${cost_per_byte.toFixed(18)}`)
console.log(`Token multiplier per byte with profit: ${token_multiplier_per_byte_w_profit.toFixed(18)}`)
