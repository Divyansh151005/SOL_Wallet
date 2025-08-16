import { Queue, Worker, Job, QueueEvents } from 'bullmq'
import Redis from 'ioredis'
import { connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, Keypair } from './solana.js'
import { base64ToBytes } from './parseKey.js'
import { explorerTx } from './solana.js'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
})

// Queue definitions with enhanced configuration
export const airdropQueue = new Queue('airdrop', { 
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  }
})

export const sendQueue = new Queue('send', { 
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  }
})

// Job types
interface AirdropJob {
  pubkey: string
  amount?: number
  userId?: string
  requestId?: string
}

interface SendJob {
  fromSecretBase64: string
  toPubkey: string
  amountSOL: number
  userId?: string
  requestId?: string
}

// Enhanced airdrop worker with progress tracking
new Worker('airdrop', async (job: Job<AirdropJob>) => {
  const { pubkey, amount = 1, userId, requestId } = job.data
  
  try {
    // Update progress
    await job.updateProgress(10)
    
    const pk = new PublicKey(pubkey)
    await job.updateProgress(20)
    
    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')
    await job.updateProgress(30)
    
    const lamports = amount * LAMPORTS_PER_SOL
    await job.updateProgress(40)
    
    // Request airdrop
    const signature = await connection.requestAirdrop(pk, lamports)
    await job.updateProgress(60)
    
    // Wait for confirmation with timeout
    const confirmation = await Promise.race([
      connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Confirmation timeout')), 30000))
    ])
    
    await job.updateProgress(90)
    
    // Final confirmation check
    const { value } = await connection.getSignatureStatuses([signature])
    const status = value[0]
    
    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`)
    }
    
    await job.updateProgress(100)
    
    return { 
      signature, 
      amountSOL: amount, 
      status: 'airdrop-confirmed',
      explorerUrl: explorerTx(signature),
      userId,
      requestId,
      confirmedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error(`Airdrop job ${job.id} failed:`, error)
    
    // Fallback to smaller amount if first attempt fails
    if (amount === 1 && job.attemptsMade < 2) {
      console.log(`Attempting fallback airdrop of 0.25 SOL for ${pubkey}`)
      const fallbackJob = await airdropQueue.add('airdrop', { 
        pubkey, 
        amount: 0.25, 
        userId, 
        requestId 
      }, { 
        delay: 5000,
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 }
      })
      
      return { 
        fallbackJobId: fallbackJob.id, 
        status: 'airdrop-fallback-queued',
        message: 'Fallback airdrop queued due to initial failure'
      }
    }
    
    throw error
  }
}, { 
  connection: redis,
  concurrency: 5,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
})

// Enhanced send worker with progress tracking
new Worker('send', async (job: Job<SendJob>) => {
  const { fromSecretBase64, toPubkey, amountSOL, userId, requestId } = job.data
  
  try {
    await job.updateProgress(10)
    
    const kp = Keypair.fromSecretKey(base64ToBytes(fromSecretBase64))
    await job.updateProgress(20)
    
    const to = new PublicKey(toPubkey)
    await job.updateProgress(30)
    
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL)
    await job.updateProgress(40)
    
    // Build transaction
    const ix = SystemProgram.transfer({ 
      fromPubkey: kp.publicKey, 
      toPubkey: to, 
      lamports 
    })
    
    const tx = new Transaction().add(ix)
    await job.updateProgress(50)
    
    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    await job.updateProgress(60)
    
    tx.recentBlockhash = blockhash
    tx.feePayer = kp.publicKey
    tx.sign(kp)
    await job.updateProgress(70)
    
    // Send transaction
    const signature = await connection.sendRawTransaction(tx.serialize())
    await job.updateProgress(80)
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({ 
      signature, 
      blockhash, 
      lastValidBlockHeight 
    }, 'confirmed')
    
    await job.updateProgress(90)
    
    // Verify transaction success
    const { value } = await connection.getSignatureStatuses([signature])
    const status = value[0]
    
    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`)
    }
    
    await job.updateProgress(100)
    
    return { 
      signature, 
      explorerUrl: explorerTx(signature),
      status: 'send-confirmed',
      amountSOL,
      userId,
      requestId,
      confirmedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error(`Send job ${job.id} failed:`, error)
    throw error
  }
}, { 
  connection: redis,
  concurrency: 3,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
})

// Queue event listeners for monitoring
const airdropEvents = new QueueEvents('airdrop', { connection: redis })
const sendEvents = new QueueEvents('send', { connection: redis })

airdropEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`✅ Airdrop job ${jobId} completed successfully:`, returnvalue)
})

airdropEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Airdrop job ${jobId} failed:`, failedReason)
})

sendEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`✅ Send job ${jobId} completed successfully:`, returnvalue)
})

sendEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Send job ${jobId} failed:`, failedReason)
})

// Queue monitoring and statistics
export async function getQueueStats() {
  const airdropStats = await airdropQueue.getJobCounts('active', 'waiting', 'completed', 'failed')
  const sendStats = await sendQueue.getJobCounts('active', 'waiting', 'completed', 'failed')
  
  return {
    airdrop: airdropStats,
    send: sendStats,
    timestamp: new Date().toISOString()
  }
}

export async function getQueueJobs(queueName: 'airdrop' | 'send', states: ('active' | 'waiting' | 'completed' | 'failed')[] = ['active', 'waiting']) {
  const queue = queueName === 'airdrop' ? airdropQueue : sendQueue
  const jobs = await queue.getJobs(states)
  
  return jobs.map(job => ({
    id: job.id,
    name: job.name,
    state: job.state,
    data: job.data,
    progress: job.progress,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason
  }))
}

export function setupQueues() {
  console.log('🚀 Enhanced BullMQ queues initialized')
  
  // Log queue stats every 2 minutes
  setInterval(async () => {
    try {
      const stats = await getQueueStats()
      console.log('📊 Queue Stats:', stats)
    } catch (error) {
      console.error('Failed to get queue stats:', error)
    }
  }, 120000)
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🔄 Shutting down queues gracefully...')
    await airdropQueue.close()
    await sendQueue.close()
    await airdropEvents.close()
    await sendEvents.close()
    await redis.quit()
    console.log('✅ Queues shut down successfully')
  })
  
  process.on('SIGINT', async () => {
    console.log('🔄 Shutting down queues gracefully...')
    await airdropQueue.close()
    await sendQueue.close()
    await airdropEvents.close()
    await sendEvents.close()
    await redis.quit()
    console.log('✅ Queues shut down successfully')
    process.exit(0)
  })
}
