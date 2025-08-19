# WGS Wallet Backend

Advanced Solana wallet backend with queuing, authentication, webhooks, and SPL token support.

## 🚀 Advanced Features

### 1. **Queues (BullMQ + Redis)**
- **Airdrop Queue**: Handles devnet airdrop requests with automatic fallback (1 SOL → 0.25 SOL)
- **Send Queue**: Processes SOL transfers with retry logic and exponential backoff
- **Concurrency Control**: 5 concurrent airdrops, 3 concurrent sends
- **Job Monitoring**: Track job status via `/api/airdrop/status/:jobId` and `/api/send/status/:jobId`

### 2. **Authentication (JWT)**
- **Protected Routes**: Watchlist operations require valid JWT token
- **Demo Login**: `POST /api/wallet/login` creates demo user with token
- **Token Format**: `Authorization: Bearer <jwt_token>`
- **User Isolation**: Each user has separate watchlist and webhook subscriptions

### 3. **Webhook Notifications**
- **Transaction Monitoring**: Automatic monitoring of transaction confirmations
- **Real-time Updates**: Webhooks sent when signatures finalize
- **HMAC Security**: Signed payloads with shared secret
- **Subscription Management**: Add/remove webhook endpoints per user

### 4. **SPL Token Support**
- **Token Transfers**: `POST /api/send/token` for SPL token operations
- **Automatic ATA**: Handles associated token account creation
- **Decimal Handling**: Respects token mint decimals
- **Future Ready**: Foundation for extended token operations

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+
- Redis server (for queues)
- Solana CLI (optional, for testing)

### Environment Variables
```bash
PORT=8787
SOLANA_RPC=https://api.devnet.solana.com
SQLITE_PATH=./wgs.sqlite
JWT_SECRET=your-secret-key
REDIS_URL=redis://localhost:6379
```

### Install Dependencies
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## 📡 API Endpoints

### Authentication
- `POST /api/wallet/login` - Create demo user and get JWT token

### Wallet Management
- `POST /api/wallet/create` - Generate new keypair
- `POST /api/wallet/import` - Import existing key
- `GET /api/wallet/:pubkey` - Get wallet info

### Balance & Airdrop
- `GET /api/balance/:pubkey` - Get SOL balance
- `POST /api/airdrop` - Queue airdrop request
- `GET /api/airdrop/status/:jobId` - Check airdrop job status

### Transfers
- `POST /api/send` - Queue SOL transfer
- `POST /api/send/token` - Send SPL tokens
- `GET /api/send/status/:jobId` - Check transfer job status

### Watchlist (Authenticated)
- `GET /api/watchlist` - List saved addresses
- `POST /api/watchlist` - Add address to watchlist
- `DELETE /api/watchlist/:address` - Remove address
- `POST /api/watchlist/webhooks` - Subscribe to webhooks
- `DELETE /api/watchlist/webhooks` - Unsubscribe from webhooks
- `POST /api/watchlist/track/:signature` - Track transaction for notifications

### System
- `GET /api/health` - Health check

## 🔧 Usage Examples

### 1. Get Authentication Token
```bash
curl -X POST http://localhost:8787/api/wallet/login
# Response: {"userId": "user_123", "token": "jwt_token_here"}
```

### 2. Add to Watchlist (Authenticated)
```bash
curl -X POST http://localhost:8787/api/watchlist \
  -H "Authorization: Bearer jwt_token_here" \
  -H "Content-Type: application/json" \
  -d '{"address": "your_solana_address", "label": "My Wallet"}'
```

### 3. Queue Airdrop
```bash
curl -X POST http://localhost:8787/api/airdrop \
  -H "Content-Type: application/json" \
  -d '{"pubkey": "your_solana_address"}'
# Response: {"status": "airdrop-pending", "jobId": "job_123"}
```

### 4. Check Job Status
```bash
curl http://localhost:8787/api/airdrop/status/job_123
```

### 5. Subscribe to Webhooks
```bash
curl -X POST http://localhost:8787/api/watchlist/webhooks \
  -H "Authorization: Bearer jwt_token_here" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-webhook-url.com/notify", "secret": "shared_secret"}'
```

### 6. Send SPL Tokens
```bash
curl -X POST http://localhost:8787/api/send/token \
  -H "Content-Type: application/json" \
  -d '{
    "fromSecretBase64": "your_base64_secret",
    "toPubkey": "recipient_address",
    "mintAddress": "token_mint_address",
    "amount": 100,
    "tokenType": "spl-token"
  }'
```

## 🔒 Security Features

- **Rate Limiting**: 60 requests per minute per IP
- **JWT Authentication**: Secure token-based auth for sensitive operations
- **HMAC Signing**: Webhook payloads signed with shared secrets
- **Input Validation**: Zod schema validation for all endpoints
- **CORS Protection**: Configurable cross-origin restrictions
- **Helmet Security**: HTTP security headers

## 🚀 Performance Features

- **Queue Processing**: Asynchronous job processing with Redis
- **Concurrency Control**: Configurable worker concurrency
- **Retry Logic**: Exponential backoff for failed operations
- **Job Cleanup**: Automatic cleanup of completed/failed jobs
- **Connection Pooling**: Efficient Redis and Solana RPC connections

## 🔮 Future Enhancements

- **Database Integration**: PostgreSQL/MySQL for production
- **User Management**: Full user registration and authentication
- **Multi-chain Support**: Extend beyond Solana
- **Advanced Analytics**: Transaction history and analytics
- **Mobile SDK**: Native mobile app support
- **WebSocket Support**: Real-time updates via WebSockets

## 🧪 Testing

### Start Redis
```bash
redis-server
```

### Start Backend
```bash
npm run dev
```

### Test Endpoints
```bash
# Health check
curl http://localhost:8787/api/health

# Create demo user
curl -X POST http://localhost:8787/api/wallet/login

# Test with token
TOKEN="your_jwt_token"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/watchlist
```

## 📝 Notes

- **Development Mode**: Uses in-memory storage for webhooks (not persistent)
- **Demo Tokens**: JWT tokens expire in 7 days
- **Queue Fallbacks**: Airdrop automatically retries with smaller amounts
- **Error Handling**: Comprehensive error handling with meaningful messages
- **Logging**: Morgan HTTP logging for debugging

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes
4. Add tests
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details



