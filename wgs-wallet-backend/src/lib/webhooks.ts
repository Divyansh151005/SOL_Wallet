import cron from 'node-cron'
import { connection, PublicKey, Keypair, Transaction } from './solana.js'
import { base64ToBytes } from './parseKey.js'
import { createTransferInstruction, getAssociatedTokenAddress, getMint, createAssociatedTokenAccountInstruction } from '@solana/spl-token'

// Webhook storage (in production, use Redis/database)
interface WebhookSubscription {
  userId: string
  url: string
  secret: string
  signatures: string[]
  createdAt: Date
  lastUsed: Date
}

const webhookSubscriptions = new Map<string, WebhookSubscription>()

// Enhanced SPL Token transfer function with ATA creation
export async function sendSplToken(
  fromSecretBase64: string,
  mintAddress: string,
  toAddress: string,
  amount: number
): Promise<{ signature: string; explorerUrl: string; tokenAmount: string }> {
  const from = Keypair.fromSecretKey(base64ToBytes(fromSecretBase64))
  const mint = new PublicKey(mintAddress)
  const to = new PublicKey(toAddress)
  
  try {
    // Get token decimals
    const mintInfo = await getMint(connection, mint)
    const decimals = mintInfo.decimals
    
    // Get associated token accounts
    const fromAta = await getAssociatedTokenAddress(mint, from.publicKey)
    const toAta = await getAssociatedTokenAddress(mint, to)
    
    // Check if recipient ATA exists, create if not
    const toAtaInfo = await connection.getAccountInfo(toAta)
    const instructions = []
    
    if (!toAtaInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          from.publicKey,
          toAta,
          to,
          mint
        )
      )
    }
    
    // Create transfer instruction
    const transferAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)))
    instructions.push(
      createTransferInstruction(
        fromAta,
        toAta,
        from.publicKey,
        transferAmount
      )
    )
    
    // Build and send transaction
    const tx = new Transaction().add(...instructions)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    tx.recentBlockhash = blockhash
    tx.feePayer = from.publicKey
    tx.sign(from)
    
    const signature = await connection.sendRawTransaction(tx.serialize())
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
    
    return { 
      signature, 
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      tokenAmount: `${amount} (${decimals} decimals)`
    }
  } catch (error: any) {
    console.error('SPL token transfer failed:', error)
    throw new Error(`SPL token transfer failed: ${error?.message || 'Unknown error'}`)
  }
}

// Enhanced webhook management
export function subscribeToWebhooks(userId: string, url: string, secret: string) {
  const subscription: WebhookSubscription = {
    userId,
    url,
    secret,
    signatures: [],
    createdAt: new Date(),
    lastUsed: new Date()
  }
  webhookSubscriptions.set(userId, subscription)
  console.log(`Webhook subscription added for user ${userId} to ${url}`)
}

export function unsubscribeFromWebhooks(userId: string) {
  const sub = webhookSubscriptions.get(userId)
  if (sub) {
    console.log(`Webhook subscription removed for user ${userId}`)
    webhookSubscriptions.delete(userId)
  }
}

export function addSignatureToTrack(userId: string, signature: string) {
  const sub = webhookSubscriptions.get(userId)
  if (sub) {
    sub.signatures.push(signature)
    sub.lastUsed = new Date()
    console.log(`Signature ${signature} added to tracking for user ${userId}`)
  }
}

// Enhanced webhook notification with retry logic
async function sendWebhook(url: string, payload: any, secret: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WGS-Signature': generateHmac(payload, secret),
          'X-WGS-Attempt': attempt.toString(),
          'User-Agent': 'WGS-Wallet-Backend/1.0'
        },
        body: JSON.stringify(payload),
        // timeout: 10000 // 10 second timeout
      })
      
      if (response.ok) {
        console.log(`Webhook sent successfully to ${url} (attempt ${attempt})`)
        return
      } else {
        console.warn(`Webhook failed for ${url}: ${response.status} (attempt ${attempt})`)
      }
    } catch (error) {
      console.error(`Webhook error for ${url} (attempt ${attempt}):`, error)
    }
    
    if (attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  console.error(`Webhook failed after ${retries} attempts for ${url}`)
}

// Enhanced HMAC generation
function generateHmac(payload: any, secret: string): string {
  const data = JSON.stringify(payload)
  const crypto = require('crypto')
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

// Enhanced transaction monitoring with better error handling
function setupTransactionMonitoring() {
  cron.schedule('*/10 * * * * *', async () => {
    for (const [userId, subscription] of webhookSubscriptions) {
      const pendingSignatures = subscription.signatures.filter(sig => sig)
      
      for (const signature of pendingSignatures) {
        try {
          const status = await connection.getSignatureStatuses([signature])
          const txStatus = status.value[0]
          
          if (txStatus?.confirmationStatus === 'finalized') {
            // Send webhook with enhanced payload
            const payload = {
              type: 'transaction.finalized',
              signature,
              status: 'finalized',
              timestamp: new Date().toISOString(),
              explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
              userId: subscription.userId,
              webhookId: subscription.url
            }
            
            await sendWebhook(subscription.url, payload, subscription.secret)
            
            // Remove from tracking
            subscription.signatures = subscription.signatures.filter(sig => sig !== signature)
            subscription.lastUsed = new Date()
            
            console.log(`Transaction ${signature} finalized and webhook sent for user ${userId}`)
          } else if (txStatus?.err) {
            // Transaction failed
            const payload = {
              type: 'transaction.failed',
              signature,
              status: 'failed',
              error: txStatus.err,
              timestamp: new Date().toISOString(),
              explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
              userId: subscription.userId
            }
            
            await sendWebhook(subscription.url, payload, subscription.secret)
            
            // Remove failed transaction from tracking
            subscription.signatures = subscription.signatures.filter(sig => sig !== signature)
            console.log(`Transaction ${signature} failed for user ${userId}`)
          }
        } catch (error) {
          console.error(`Error monitoring signature ${signature} for user ${userId}:`, error)
        }
      }
    }
  })
}

// Get webhook statistics
export function getWebhookStats() {
  const stats = {
    totalSubscriptions: webhookSubscriptions.size,
    activeSubscriptions: 0,
    totalSignaturesTracked: 0,
    subscriptions: [] as any[]
  }
  
  for (const [userId, sub] of webhookSubscriptions) {
    stats.activeSubscriptions++
    stats.totalSignaturesTracked += sub.signatures.length
    stats.subscriptions.push({
      userId,
      url: sub.url,
      signaturesCount: sub.signatures.length,
      createdAt: sub.createdAt,
      lastUsed: sub.lastUsed
    })
  }
  
  return stats
}

export function setupWebhooks() {
  console.log('🔔 Enhanced webhook system initialized')
  setupTransactionMonitoring()
  
  // Log webhook stats every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    const stats = getWebhookStats()
    console.log('📊 Webhook Stats:', stats)
  })
}

