import { Router } from 'express'
import { z } from 'zod'
import { sendQueue } from '../lib/queues.js'
import { sendSplToken } from '../lib/webhooks.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const sendSolSchema = z.object({
  fromSecretBase64: z.string().min(10),
  toPubkey: z.string().min(20),
  amountSOL: z.number().positive(),
})

const sendTokenSchema = z.object({
  fromSecretBase64: z.string().min(10),
  toPubkey: z.string().min(20),
  mintAddress: z.string().min(20),
  amount: z.number().positive(),
  tokenType: z.literal('spl-token')
})

// Send SOL via queue
router.post('/', async (req, res) => {
  try {
    const { fromSecretBase64, toPubkey, amountSOL } = sendSolSchema.parse(req.body)
    
    // Add to queue with retry logic
    const job = await sendQueue.add('send', { fromSecretBase64, toPubkey, amountSOL }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 }
    })
    
    res.json({ 
      status: 'send-pending', 
      jobId: job.id,
      message: 'Transfer queued successfully. Use /status/:jobId to monitor progress.'
    })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Failed to queue transfer' })
  }
})

// Send SPL tokens with full implementation
router.post('/token', async (req, res) => {
  try {
    const { fromSecretBase64, toPubkey, mintAddress, amount } = sendTokenSchema.parse(req.body)
    
    const result = await sendSplToken(fromSecretBase64, mintAddress, toPubkey, amount)
    
    res.json({ 
      status: 'token-sent',
      ...result,
      message: 'SPL token transfer completed successfully'
    })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Failed to send token' })
  }
})

// Get job status and result
router.get('/status/:jobId', async (req, res) => {
  try {
    const job = await sendQueue.getJob(req.params.jobId)
    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }
    
    const state = await job.getState()
    const result = job.returnvalue
    const failedReason = job.failedReason
    
    res.json({ 
      jobId: job.id,
      state,
      result,
      failedReason,
      progress: job.progress,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to get job status' })
  }
})

// Get all send jobs (for monitoring)
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await sendQueue.getJobs(['active', 'waiting', 'completed', 'failed'])
    const jobStats = await sendQueue.getJobCounts('active', 'waiting', 'completed', 'failed')
    
    res.json({ 
      jobs: jobs.map(job => ({
        id: job.id,
        state: job.state,
        data: job.data,
        timestamp: job.timestamp
      })),
      stats: jobStats
    })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to get jobs' })
  }
})

export default router


