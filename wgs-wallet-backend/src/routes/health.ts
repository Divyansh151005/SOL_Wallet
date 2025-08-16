import { Router } from 'express'
import { getQueueStats } from '../lib/queues.js'
import { getWebhookStats } from '../lib/webhooks.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const queueStats = await getQueueStats()
    const webhookStats = getWebhookStats()
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      queues: queueStats,
      webhooks: webhookStats
    })
  } catch (error: any) {
    res.status(500).json({ 
      status: 'error', 
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

export default router


