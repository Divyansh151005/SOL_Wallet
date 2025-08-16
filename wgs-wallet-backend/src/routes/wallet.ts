import { Router } from 'express'
import { z } from 'zod'
import { Keypair, PublicKey } from '@solana/web3.js'
import { bytesToBase64, parseSecret, base64ToBytes } from '../lib/parseKey.js'
import { explorerAddress } from '../lib/solana.js'
import { validate } from '../middleware/validate.js'
import { createDemoUser } from '../middleware/auth.js'

const router = Router()

// Demo login endpoint
router.post('/login', (_req, res) => {
  const { userId, token } = createDemoUser()
  res.json({ 
    userId, 
    token,
    message: 'Demo user created. Use this token in Authorization: Bearer <token> header'
  })
})

router.post('/create', (_req, res) => {
  const kp = Keypair.generate()
  const secretBase64 = bytesToBase64(kp.secretKey)
  res.json({ publicKey: kp.publicKey.toBase58(), secretBase64 })
})

router.post('/import', validate(z.object({ input: z.string().min(1) })), (req, res) => {
  const { input } = req.body as { input: string }
  const bytes = parseSecret(input)
  if (!bytes) return res.status(400).json({ error: 'Invalid key input' })
  let kp: Keypair
  if (bytes.length === 64) kp = Keypair.fromSecretKey(bytes)
  else if (bytes.length === 32) kp = Keypair.fromSeed(bytes)
  else return res.status(400).json({ error: 'Expected 32 or 64 byte key' })
  const secretBase64 = bytesToBase64(kp.secretKey)
  res.json({ publicKey: kp.publicKey.toBase58(), secretBase64 })
})

router.get('/:pubkey', (req, res) => {
  try {
    const pk = new PublicKey(req.params.pubkey)
    const base58 = pk.toBase58()
    const short = `${base58.slice(0, 4)}...${base58.slice(-4)}`
    res.json({ publicKey: base58, short, explorerUrl: explorerAddress(base58) })
  } catch {
    res.status(400).json({ error: 'Invalid pubkey' })
  }
})

export default router


