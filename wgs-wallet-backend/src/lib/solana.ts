import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, PublicKey, RpcResponseAndContext, SignatureResult, Keypair, Transaction, SystemProgram } from '@solana/web3.js'

const RPC_URL = process.env.SOLANA_RPC || clusterApiUrl('devnet')
export const connection = new Connection(RPC_URL, 'confirmed')
export { LAMPORTS_PER_SOL, PublicKey, Keypair, Transaction, SystemProgram }

export function explorerAddress(pubkey: string) {
  return `https://explorer.solana.com/address/${pubkey}?cluster=devnet`
}
export function explorerTx(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`
}

export async function getBalanceLamports(pubkey: string) {
  const lamports = await connection.getBalance(new PublicKey(pubkey))
  return lamports
}

export async function confirmSignature(signature: string): Promise<RpcResponseAndContext<SignatureResult> | null> {
  try {
    const status = await connection.getSignatureStatuses([signature])
    const value = status.value?.[0]
    if (!value) return null
    if (value.err) throw new Error('Transaction failed')
    return { context: status.context, value } as any
  } catch {
    return null
  }
}


