import { ReceiptT } from "@/schemas"
import { timeout } from "@/utils"
import Cache from "ttl"

const StatusCache = new Cache({ ttl: 10000 }) // 10 seconds
const BalancesCache = new Cache({ ttl: 10000 }) // 10 seconds
const SubsidizedBalancesCache = new Cache({ ttl: 10000 }) // 10 seconds

export const getStatus = async ({ user_id }: { user_id: string }): Promise<any> => {
  // fetch status from users
  const status = StatusCache.get(user_id)
  if (status) return status
  const res = await timeout({
    ms: 15000,
    fn: fetch(`https://wallet.promptc0.com/getStatus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id }),
    })
  }).then(d => 'json' in d && d.json())
  if(!res || 'error' in res || typeof res.result === undefined) return false
  StatusCache.put(user_id, res.result)
  return res.result
}
export const getBalance = async ({ user_id }: { user_id: string }): Promise<any> => {
  // fetch balance from wallets
  const balance = BalancesCache.get(user_id)
  if (balance) return balance
  const res = await timeout({
    ms: 15000,
    fn: fetch(`https://wallet.promptc0.com/getBalance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id }),
    })
  }).then(d => 'json' in d && d.json())
  if(!res || 'error' in res || typeof res.result === undefined) return false
  BalancesCache.put(user_id, res.result)
  return res.result
}
export const getSubsidizedBalance = async ({ user_id }: { user_id: string }): Promise<any> => {
  // fetch balance from wallets
  const balance = SubsidizedBalancesCache.get(user_id)
  if (balance) return balance
  const res = await timeout({
    ms: 15000,
    fn: fetch(`https://wallet.promptc0.com/getBalance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id }),
    })
  }).then(d => 'json' in d && d.json())
  if(!res || 'error' in res || typeof res.result === undefined) return false
  SubsidizedBalancesCache.put(user_id, res.result)
  return res.result
}

export const report = async ({ user_id, reason, receipt }: { user_id: string, reason: 'INSUFFICIENT_FUNDS', receipt: ReceiptT }): Promise<any> => {
  // TODO: Send report with receipt to the service. Service will check if the receipt is valid and suspend user if the user has signed request without enough funds
}

export const charge = async ({ receipt }: { receipt: ReceiptT }): Promise<any> => {
  return timeout({
    ms: 15000,
    fn: fetch(`https://wallet.promptc0.com/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ receipt }),
    }).then((res) => res.json()),
  })
}
