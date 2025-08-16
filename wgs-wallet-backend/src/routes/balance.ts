import { Router } from 'express'
import { getBalanceLamports, LAMPORTS_PER_SOL, PublicKey } from '../lib/solana.js'

const router = Router()

router.get('/:pubkey', async (req, res) => {
  try {
    const pk = new PublicKey(req.params.pubkey)
    const lamports = await getBalanceLamports(pk.toBase58())
    res.json({ lamports, sol: lamports / LAMPORTS_PER_SOL })
  } catch (e: any) {
    res.status(400).json({ error: 'Invalid pubkey' })
  }
})

export default router


