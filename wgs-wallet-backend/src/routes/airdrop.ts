import { Router } from 'express'
import { z } from 'zod'
import { airdropQueue } from '../lib/queues.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const bodySchema = z.object({ pubkey: z.string().min(20) })

router.post('/', validate(bodySchema), async (req, res) => {
  try {
    const { pubkey } = req.body as { pubkey: string }
    
    // Add to queue with retry logic
    const job = await airdropQueue.add('airdrop', { pubkey, amount: 1 }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 }
    })
    
    res.json({ 
      status: 'airdrop-pending', 
      jobId: job.id,
      message: 'Airdrop queued successfully. Use /status/:jobId to monitor progress.'
    })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to queue airdrop' })
  }
})

// Get job status and result
router.get('/status/:jobId', async (req, res) => {
  try {
    const job = await airdropQueue.getJob(req.params.jobId)
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

// Get all airdrop jobs (for monitoring)
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await airdropQueue.getJobs(['active', 'waiting', 'completed', 'failed'])
    const jobStats = await airdropQueue.getJobCounts('active', 'waiting', 'completed', 'failed')
    
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


