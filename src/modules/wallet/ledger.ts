import { ErrorT, ReceiptS, ReceiptT, SignedTransactionT } from "@/schemas"
import { nanoid } from "nanoid"
import { Cache } from 'ttl'

const BalancesCache = new Cache({ ttl: 10000 }) // 10 seconds
const SubsidizedBalancesCache = new Cache({ ttl: 10000 }) // 10 seconds

export const getStatus = async ({ user_id }: { user_id: string }): Promise<any> => {
  // fetch status from users
}
export const getBalance = async ({ user_id }: { user_id: string }): Promise<any> => {
  // fetch balance from wallets
  const balance = BalancesCache.get(user_id)
  if (balance) return balance
  // TODO: get balance
  const updated_balance = 123
  BalancesCache.set(user_id, updated_balance)
  return updated_balance
}
export const getSubsidizedBalance = async ({ user_id }: { user_id: string }): Promise<any> => {
  // fetch subsidized balance from wallets
  // fetch balance from wallets
  const balance = SubsidizedBalancesCache.get(user_id)
  if (balance) return balance
  // TODO: get balance
  const updated_balance = 123
  SubsidizedBalancesCache.set(user_id, updated_balance)
  return updated_balance
}

export const suspend = async ({ user_id }: { user_id: string }): Promise<any> => {
  // suspend wallet
}

export const charge = async ({
  user_id,
  amount,
  tx,
}: {
  user_id: string
  amount: number
  tx: SignedTransactionT
}): Promise<any> => {
  // generate receipt id
  const receipt_id = nanoid()

  // compute costs

  // create receipt
  /* const receipt: ReceiptT = {
    receipt_id,
    call,
    cost_usd: final_cost.input.cost_usd + final_cost.output.cost_usd,
    details: final_cost,
  }

  if (!ReceiptS.safeParse(receipt).success) {
    // TODO: add error piping to alert service
    await suspend({ user_id })
    return {
      code: 500,
      error:
        "There was in error in processing receipt. We have alerted the team. To prevent fraud, your account is temporarily suspended until we can verify this was a technical error.",
    }
  }
 */
  // charge the wallet

  // verify charge

  // issue receipt
}
