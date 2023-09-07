import { blake3 } from "@noble/hashes/blake3"
import b4a from "b4a"
import { SignatureT, BasePayloadT, Hex } from "@/schemas"
import { verify, utils, getPublicKey, signAsync } from "@noble/secp256k1"
import Cache from "ttl"
import { nanoid } from "nanoid"
import { debug } from "@/utils"
const d = debug("security")

const challenge_cache = new Cache({
  ttl: 1000 * 1000,
})

export async function createChallenge({ ip, request_id }: { ip: string; request_id: string }) {
  const c = nanoid()
  challenge_cache.put(c, { ip, request_id })
  return c
}

export async function checkChallenge({
  challenge,
  ip,
  request_id,
}: {
  challenge: string
  ip: string
  request_id: string
}) {
  const dqt = challenge_cache.get(challenge)
  if (!dqt) {
    d(`challenge ${challenge} not found`)
    return false
  }
  if (dqt.ip !== ip || dqt.request_id !== request_id) {
    d(`challenge ${challenge} does not match ip ${ip} or request_id ${request_id}`)
    return false
  }
  return true
}

export function createHash({ str }: { str: Uint8Array | string }): Uint8Array {
  return blake3(b4a.isBuffer(str) ? str : b4a.from(str, "hex"))
}

export function verifySignature({
  message,
  signature,
  public_key,
}: {
  message: Hex
  signature: Hex
  public_key: Hex
}): boolean {
  const hash = buf2hex({ input: createHash({ str: message }) })
  return verify(signature, hash, public_key)
}

export async function verifyAuth(data: BasePayloadT & { ip: string; request_id: string }) {
  if (data && typeof data === "object" && "auth" in data && "params" in data) {
    const auth = data.auth as SignatureT
    // we need to verify the signature by generating the same hash as the client
    // to avoid signature reuse, we need to include the given challenge in the hash as nonce
    if (!(await checkChallenge({ challenge: data.auth.n || "", ip: data.ip, request_id: data.request_id }))) return false

    d(`verifying signature for ${data.request_id}`)
    const message = createHash({
      str: JSON.stringify({ offer: data.offer, params: data.params || {}, nonce: data.auth.n, request_id: data.id }),
    })
    return verifySignature({ message: buf2hex({ input: message }), signature: auth.s, public_key: auth.pk })
  } else return { error: "Missing auth or params" }
}

export async function keyPair() {
  const private_key = utils.randomPrivateKey()
  const public_key = getPublicKey(private_key)
  return { private_key: b4a.toString(private_key, "hex"), public_key: b4a.toString(public_key, "hex") }
}

export async function signMessage(message: Uint8Array | string, secretKey: Uint8Array): Promise<Uint8Array> {
  const m = b4a.isBuffer(message) ? b4a.from(message) : message
  const hash = buf2hex({ input: createHash({ str: m }) })
  const s = await signAsync(hash, buf2hex({ input: secretKey }))
  return s.toCompactRawBytes()
}

export async function getPublicKeyFromPrivate({ private_key }: { private_key: string }) {
  return buf2hex({ input: await getPublicKey(private_key) })
}

export function buf2hex({ input, add0x = false }: { input: Uint8Array | Buffer; add0x?: boolean }): string {
  const str = b4a.toString(input, "hex")
  if (!add0x) return str
  return "0x" + str
}

export function hex2buf({ input }: { input: string }): Uint8Array {
  return b4a.from(input.replace(/^0x/, ""), "hex")
}
