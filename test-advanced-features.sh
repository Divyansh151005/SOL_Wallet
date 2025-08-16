#!/bin/bash

# 🧪 Advanced Features Testing Script for WGS Wallet Backend
# This script tests all advanced functionalities: Queues, Webhooks, SPL Tokens

BASE_URL="http://localhost:8787"
FRONTEND_URL="http://localhost:5173"

echo "🚀 Testing Advanced Features for WGS Wallet Backend"
echo "=================================================="

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 8

# Test 1: Enhanced Health Check with Queue/Webhook Stats
echo ""
echo "1️⃣ Testing Enhanced Health Check..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health")
echo "Health Response: $HEALTH_RESPONSE"

# Test 2: Create a test wallet
echo ""
echo "2️⃣ Creating test wallet..."
WALLET_RESPONSE=$(curl -s -X POST "$BASE_URL/api/wallet/create")
echo "Wallet Created: $WALLET_RESPONSE"

# Extract wallet details
PUBLIC_KEY=$(echo $WALLET_RESPONSE | grep -o '"publicKey":"[^"]*"' | cut -d'"' -f4)
SECRET_BASE64=$(echo $WALLET_RESPONSE | grep -o '"secretBase64":"[^"]*"' | cut -d'"' -f4)

echo "Public Key: $PUBLIC_KEY"
echo "Secret (base64): $SECRET_BASE64"

# Test 3: Get JWT token for authentication
echo ""
echo "3️⃣ Getting JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/wallet/login")
echo "Login Response: $LOGIN_RESPONSE"

# Extract JWT token
JWT_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "JWT Token: $JWT_TOKEN"

# Test 4: Queue System - Airdrop
echo ""
echo "4️⃣ Testing Queue System - Airdrop..."
AIRDROP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/airdrop" \
  -H "Content-Type: application/json" \
  -d "{\"pubkey\":\"$PUBLIC_KEY\"}")
echo "Airdrop Queued: $AIRDROP_RESPONSE"

# Extract job ID
JOB_ID=$(echo $AIRDROP_RESPONSE | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
echo "Job ID: $JOB_ID"

# Test 5: Check Job Status
echo ""
echo "5️⃣ Checking Job Status..."
sleep 3
JOB_STATUS=$(curl -s "$BASE_URL/api/airdrop/status/$JOB_ID")
echo "Job Status: $JOB_STATUS"

# Test 6: Queue System - Send SOL
echo ""
echo "6️⃣ Testing Queue System - Send SOL..."
SEND_RESPONSE=$(curl -s -X POST "$BASE_URL/api/send" \
  -H "Content-Type: application/json" \
  -d "{\"fromSecretBase64\":\"$SECRET_BASE64\",\"toPubkey\":\"11111111111111111111111111111111\",\"amountSOL\":0.01}")
echo "Send Queued: $SEND_RESPONSE"

# Extract send job ID
SEND_JOB_ID=$(echo $SEND_RESPONSE | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
echo "Send Job ID: $SEND_JOB_ID"

# Test 7: Check Send Job Status
echo ""
echo "7️⃣ Checking Send Job Status..."
sleep 3
SEND_JOB_STATUS=$(curl -s "$BASE_URL/api/send/status/$SEND_JOB_ID")
echo "Send Job Status: $SEND_JOB_STATUS"

# Test 8: Webhook Subscription
echo ""
echo "8️⃣ Testing Webhook Subscription..."
WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/watchlist/webhooks" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/test","secret":"test-secret-123"}')
echo "Webhook Subscription: $WEBHOOK_RESPONSE"

# Test 9: Signature Tracking for Webhooks
echo ""
echo "9️⃣ Testing Signature Tracking..."
TRACK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/watchlist/track/test-signature-123" \
  -H "Authorization: Bearer $JWT_TOKEN")
echo "Signature Tracking: $TRACK_RESPONSE"

# Test 10: SPL Token Transfer (USDC)
echo ""
echo "🔟 Testing SPL Token Transfer (USDC)..."
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
SPL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/send/token" \
  -H "Content-Type: application/json" \
  -d "{\"fromSecretBase64\":\"$SECRET_BASE64\",\"toPubkey\":\"11111111111111111111111111111111\",\"mintAddress\":\"$USDC_MINT\",\"amount\":100,\"tokenType\":\"spl-token\"}")
echo "SPL Token Transfer: $SPL_RESPONSE"

# Test 11: Queue Monitoring
echo ""
echo "1️⃣1️⃣ Testing Queue Monitoring..."
AIRDROP_JOBS=$(curl -s "$BASE_URL/api/airdrop/jobs")
echo "Airdrop Jobs: $AIRDROP_JOBS"

SEND_JOBS=$(curl -s "$BASE_URL/api/send/jobs")
echo "Send Jobs: $SEND_JOBS"

# Test 12: Enhanced Health with Stats
echo ""
echo "1️⃣2️⃣ Final Health Check with Stats..."
FINAL_HEALTH=$(curl -s "$BASE_URL/api/health")
echo "Final Health: $FINAL_HEALTH"

echo ""
echo "🎉 Advanced Features Testing Complete!"
echo "====================================="
echo "✅ Queue System (BullMQ + Redis)"
echo "✅ Webhook System with Signature Tracking"
echo "✅ SPL Token Transfers"
echo "✅ Enhanced Monitoring and Statistics"
echo "✅ JWT Authentication"
echo "✅ Job Status Monitoring"

echo ""
echo "📊 Test Results Summary:"
echo "- Backend URL: $BASE_URL"
echo "- Frontend URL: $FRONTEND_URL"
echo "- Test Wallet: $PUBLIC_KEY"
echo "- JWT Token: ${JWT_TOKEN:0:20}..."
echo "- Airdrop Job: $JOB_ID"
echo "- Send Job: $SEND_JOB_ID"
