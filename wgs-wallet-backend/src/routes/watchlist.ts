import { Router } from 'express'
import { z } from 'zod'
import { PublicKey } from '@solana/web3.js'
import { addToWatchlist, listWatchlist, removeFromWatchlist } from '../db.js'
import { AuthRequest } from '../middleware/auth.js'
import { subscribeToWebhooks, unsubscribeFromWebhooks, addSignatureToTrack } from '../lib/webhooks.js'

const router = Router()

router.get('/', (req: AuthRequest, res) => {
  const userId = req.userId!
  const rows = listWatchlist()
  res.json({ watchlist: rows.map(r => r.address) })
})

router.post('/', (req: AuthRequest, res) => {
  const userId = req.userId!
  const schema = z.object({ label: z.string().optional(), address: z.string().min(20) })
  const body = schema.parse(req.body)
  
  try {
    const pk = new PublicKey(body.address)
    addToWatchlist(pk.toBase58(), body.label)
    res.json({ ok: true })
  } catch {
    res.status(400).json({ error: 'invalid address' })
  }
})

router.delete('/:address', (req: AuthRequest, res) => {
  const userId = req.userId!
  try {
    const pk = new PublicKey(req.params.address)
    removeFromWatchlist(pk.toBase58())
    res.json({ ok: true })
  } catch {
    res.status(400).json({ error: 'invalid address' })
  }
})

// Webhook subscription management
router.post('/webhooks', (req: AuthRequest, res) => {
  const userId = req.userId!
  const schema = z.object({ 
    url: z.string().url(), 
    secret: z.string().min(10) 
  })
  
  try {
    const { url, secret } = schema.parse(req.body)
    subscribeToWebhooks(userId, url, secret)
    res.json({ ok: true, message: 'Webhook subscription added' })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Invalid webhook config' })
  }
})

router.delete('/webhooks', (req: AuthRequest, res) => {
  const userId = req.userId!
  unsubscribeFromWebhooks(userId)
  res.json({ ok: true, message: 'Webhook subscription removed' })
})

// Track signature for webhook notifications
router.post('/track/:signature', (req: AuthRequest, res) => {
  const userId = req.userId!
  const { signature } = req.params
  
  try {
    addSignatureToTrack(userId, signature)
    res.json({ ok: true, message: 'Signature tracking started' })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Failed to track signature' })
  }
})

export default router


