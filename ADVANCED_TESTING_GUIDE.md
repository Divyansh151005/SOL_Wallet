# 🧪 Advanced Features Testing Guide

## 🚀 **Complete Testing Guide for WGS Wallet Backend**

This guide shows you how to test all the advanced features: **Queues**, **Webhooks**, **SPL Tokens**, and **Enhanced Monitoring**.

---

## 📋 **Prerequisites**

### 1. Install Redis
```bash
# macOS
brew install redis

# Ubuntu/Debian
sudo apt-get install redis-server

# Start Redis
redis-server --daemonize yes
```

### 2. Start the Enhanced Backend
```bash
cd wgs-wallet-backend
node dist/index.js
```

### 3. Verify Backend is Running
```bash
curl http://localhost:8787/api/health
```

---

## 🧪 **1. Queue System Testing (BullMQ + Redis)**

### **Airdrop Queue Testing**

```bash
# 1. Create a test wallet
WALLET=$(curl -s -X POST http://localhost:8787/api/wallet/create)
PUBLIC_KEY=$(echo $WALLET | grep -o '"publicKey":"[^"]*"' | cut -d'"' -f4)
echo "Wallet: $PUBLIC_KEY"

# 2. Queue an airdrop
AIRDROP=$(curl -s -X POST http://localhost:8787/api/airdrop \
  -H "Content-Type: application/json" \
  -d "{\"pubkey\":\"$PUBLIC_KEY\"}")
JOB_ID=$(echo $AIRDROP | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
echo "Airdrop Job ID: $JOB_ID"

# 3. Monitor job status
curl -s http://localhost:8787/api/airdrop/status/$JOB_ID

# 4. Check all airdrop jobs
curl -s http://localhost:8787/api/airdrop/jobs
```

### **Send Queue Testing**

```bash
# 1. Get wallet secret
SECRET=$(echo $WALLET | grep -o '"secretBase64":"[^"]*"' | cut -d'"' -f4)

# 2. Queue a SOL transfer
SEND=$(curl -s -X POST http://localhost:8787/api/send \
  -H "Content-Type: application/json" \
  -d "{\"fromSecretBase64\":\"$SECRET\",\"toPubkey\":\"11111111111111111111111111111111\",\"amountSOL\":0.01}")
SEND_JOB_ID=$(echo $SEND | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
echo "Send Job ID: $SEND_JOB_ID"

# 3. Monitor send job status
curl -s http://localhost:8787/api/send/status/$SEND_JOB_ID

# 4. Check all send jobs
curl -s http://localhost:8787/api/send/jobs
```

---

## 🔔 **2. Webhook System Testing**

### **Webhook Subscription**

```bash
# 1. Get JWT token
LOGIN=$(curl -s -X POST http://localhost:8787/api/wallet/login)
JWT_TOKEN=$(echo $LOGIN | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 2. Subscribe to webhooks
curl -s -X POST http://localhost:8787/api/watchlist/webhooks \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/test",
    "secret": "test-secret-123"
  }'

# 3. Track a signature for webhook notifications
curl -s -X POST http://localhost:8787/api/watchlist/track/test-signature-123 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### **Webhook Testing with webhook.site**

1. Go to [webhook.site](https://webhook.site)
2. Copy your unique URL
3. Use it in the webhook subscription above
4. Monitor incoming webhook notifications

---

## 🪙 **3. SPL Token Testing**

### **USDC Token Transfer**

```bash
# USDC mint address on devnet
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Transfer 100 USDC
curl -s -X POST http://localhost:8787/api/send/token \
  -H "Content-Type: application/json" \
  -d "{
    \"fromSecretBase64\": \"$SECRET\",
    \"toPubkey\": \"11111111111111111111111111111111\",
    \"mintAddress\": \"$USDC_MINT\",
    \"amount\": 100,
    \"tokenType\": \"spl-token\"
  }"
```

### **Other Popular SPL Tokens for Testing**

```bash
# Raydium (RAY) - Devnet
RAY_MINT="DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"

# Serum (SRM) - Devnet  
SRM_MINT="SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt"

# Test with RAY tokens
curl -s -X POST http://localhost:8787/api/send/token \
  -H "Content-Type: application/json" \
  -d "{
    \"fromSecretBase64\": \"$SECRET\",
    \"toPubkey\": \"11111111111111111111111111111111\",
    \"mintAddress\": \"$RAY_MINT\",
    \"amount\": 50,
    \"tokenType\": \"spl-token\"
  }"
```

---

## 📊 **4. Enhanced Monitoring Testing**

### **Health Check with Statistics**

```bash
# Get comprehensive system stats
curl -s http://localhost:8787/api/health | jq '.'

# Check specific metrics
curl -s http://localhost:8787/api/health | jq '.queues'
curl -s http://localhost:8787/api/health | jq '.webhooks'
curl -s http://localhost:8787/api/health | jq '.memory'
```

### **Queue Statistics**

```bash
# Airdrop queue stats
curl -s http://localhost:8787/api/airdrop/jobs | jq '.stats'

# Send queue stats  
curl -s http://localhost:8787/api/send/jobs | jq '.stats'
```

---

## 🔐 **5. JWT Authentication Testing**

### **Protected Endpoints**

```bash
# Test without authentication (should fail)
curl -s http://localhost:8787/api/watchlist

# Test with authentication (should succeed)
curl -s -H "Authorization: Bearer $JWT_TOKEN" http://localhost:8787/api/watchlist

# Add to watchlist
curl -s -X POST http://localhost:8787/api/watchlist \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address":"11111111111111111111111111111111","label":"Test"}'
```

---

## 🎯 **6. Complete Testing Script**

Run the automated testing script:

```bash
# Make executable and run
chmod +x test-advanced-features.sh
./test-advanced-features.sh
```

---

## 📈 **7. Monitoring Dashboard**

### **Real-time Monitoring**

```bash
# Watch queue stats in real-time
watch -n 5 'curl -s http://localhost:8787/api/health | jq ".queues"'

# Watch webhook stats
watch -n 5 'curl -s http://localhost:8787/api/health | jq ".webhooks"'

# Watch memory usage
watch -n 5 'curl -s http://localhost:8787/api/health | jq ".memory"'
```

---

## 🐛 **8. Troubleshooting**

### **Common Issues**

1. **Redis Connection Error**
   ```bash
   # Check if Redis is running
   redis-cli ping
   
   # Start Redis if needed
   redis-server --daemonize yes
   ```

2. **Port Already in Use**
   ```bash
   # Kill processes on port 8787
   lsof -ti:8787 | xargs kill -9
   ```

3. **JWT Token Expired**
   ```bash
   # Get new token
   curl -s -X POST http://localhost:8787/api/wallet/login
   ```

4. **Queue Jobs Stuck**
   ```bash
   # Check job status
   curl -s http://localhost:8787/api/airdrop/status/JOB_ID
   
   # Check failed jobs
   curl -s http://localhost:8787/api/airdrop/jobs | jq '.jobs[] | select(.state == "failed")'
   ```

---

## 🎉 **9. Success Indicators**

### **✅ Queue System Working**
- Jobs are created with unique IDs
- Job status shows progress (0-100%)
- Jobs complete successfully
- Failed jobs show error details

### **✅ Webhook System Working**
- Webhook subscriptions are created
- Signatures are tracked
- Webhook.site receives notifications
- HMAC signatures are valid

### **✅ SPL Token System Working**
- Token transfers complete successfully
- Associated Token Accounts are created automatically
- Proper decimal handling
- Transaction explorer URLs are generated

### **✅ Enhanced Monitoring Working**
- Health endpoint shows comprehensive stats
- Queue statistics are accurate
- Webhook statistics are tracked
- Memory usage is monitored

---

## 🚀 **10. Production Readiness Checklist**

- [ ] Redis is properly configured
- [ ] All queue jobs complete successfully
- [ ] Webhooks are delivering notifications
- [ ] SPL token transfers work with real tokens
- [ ] JWT authentication is secure
- [ ] Monitoring shows healthy metrics
- [ ] Error handling is comprehensive
- [ ] Rate limiting is working
- [ ] Logs are being generated
- [ ] System is stable under load

---

## 📞 **Support**

If you encounter issues:

1. Check the backend logs for error messages
2. Verify Redis is running and accessible
3. Ensure all dependencies are installed
4. Check network connectivity to Solana devnet
5. Review the troubleshooting section above

**Happy Testing! 🎉**
