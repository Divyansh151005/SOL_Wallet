import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import walletRouter from './routes/wallet.js'
import balanceRouter from './routes/balance.js'
import airdropRouter from './routes/airdrop.js'
import sendRouter from './routes/send.js'
import watchlistRouter from './routes/watchlist.js'
import healthRouter from './routes/health.js'
import { errorHandler } from './middleware/errors.js'
import { authMiddleware } from './middleware/auth.js'
import { setupQueues } from './lib/queues.js'
import { setupWebhooks } from './lib/webhooks.js'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(morgan('tiny'))

// Simple rate limiter
const rateLimiter = new RateLimiterMemory({ points: 60, duration: 60 })
app.use(async (req, res, next) => {
  try {
    const key = `${req.ip}:${req.path}`
    await rateLimiter.consume(key)
    next()
  } catch {
    res.status(429).json({ error: 'Too Many Requests' })
  }
})

// Setup advanced features
setupQueues()
setupWebhooks()

app.use('/api/wallet', walletRouter)
app.use('/api/balance', balanceRouter)
app.use('/api/airdrop', airdropRouter)
app.use('/api/send', sendRouter)
app.use('/api/watchlist', authMiddleware, watchlistRouter)
app.use('/api/health', healthRouter)

app.use(errorHandler)

const port = Number(process.env.PORT || 8787)
app.listen(port, () => {
  console.log(`WGS backend listening on http://localhost:${port}`)
  console.log('🚀 All advanced features enabled: Queues, Webhooks, SPL Tokens')
})


