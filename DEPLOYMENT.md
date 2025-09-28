# ZKVault Protocol - Deployment Guide

This guide provides step-by-step instructions for deploying the ZKVault Protocol to production environments.

## 🚀 Quick Deployment

### Prerequisites

1. **Node.js 18+** and npm installed
2. **Private key** with sufficient funds on target networks
3. **API keys** for required services (see Configuration section)
4. **Vercel CLI** (for frontend deployment)

### 1. Environment Setup

```bash
# Clone and setup
git clone https://github.com/zkvault/protocol.git
cd zkvault-protocol

# Install dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Setup environment variables
cp .env.example .env
cp frontend/.env.example frontend/.env

# Edit .env files with your configuration
```

### 2. Smart Contract Deployment

```bash
# Compile contracts
npm run compile

# Deploy to testnets (recommended first)
npm run deploy:sepolia
npm run deploy:baseSepolia  
npm run deploy:filecoin

# Deploy to mainnets (when ready)
npm run deploy:polygon
npm run deploy:base

# Verify contracts
npm run verify:sepolia
npm run verify:base
npm run verify:filecoin
```

### 3. Frontend Deployment

```bash
cd frontend

# Build for production
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy to Netlify
netlify deploy --prod --dir=dist
```

### 4. Backend Deployment

```bash
cd backend

# Deploy to Railway/Render/Heroku
# Follow your preferred hosting service instructions

# Or deploy to Vercel (serverless)
vercel --prod
```

## 🔧 Detailed Configuration

### Required Environment Variables

#### Root `.env`
```bash
# Deployment
PRIVATE_KEY="your_private_key_here"
ETHEREUM_RPC_URL="https://eth-mainnet.alchemyapi.io/v2/your-api-key"
POLYGON_RPC_URL="https://polygon-rpc.com"
BASE_RPC_URL="https://mainnet.base.org"
FILECOIN_CALIBRATION_RPC_URL="https://api.calibration.node.glif.io/rpc/v1"

# Block Explorer API Keys
ETHERSCAN_API_KEY="your_etherscan_api_key"
POLYGONSCAN_API_KEY="your_polygonscan_api_key"
BASESCAN_API_KEY="your_basescan_api_key"
```

#### Frontend `.env`
```bash
# App Configuration
VITE_APP_NAME="ZKVault Protocol"
VITE_DEFAULT_CHAIN_ID=137  # Polygon mainnet

# API Keys
VITE_LIGHTHOUSE_API_KEY="your_lighthouse_api_key"
VITE_AKAVE_ACCESS_KEY_ID="your_akave_access_key"
VITE_AKAVE_SECRET_ACCESS_KEY="your_akave_secret_key"
VITE_SYNAPSE_API_KEY="your_synapse_api_key"
VITE_GELATO_API_KEY="your_gelato_api_key"
VITE_ONEINCH_API_KEY="your_1inch_api_key"
VITE_NEWS_API_KEY="your_news_api_key"

# Self Protocol
VITE_SELF_APP_NAME="ZKVault Protocol"
VITE_SELF_SCOPE="zkvault-human-verification"

# Contract Addresses (auto-populated by deployment script)
VITE_ZKVAULT_POLYGON="0x..."
VITE_DATADAO_POLYGON="0x..."
VITE_DATACOIN_POLYGON="0x..."
```

## 🌐 Network Deployment

### Supported Networks

| Network | Chain ID | Status | Purpose |
|---------|----------|--------|---------|
| Ethereum Mainnet | 1 | ✅ Ready | Main deployment |
| Polygon | 137 | ✅ Ready | Primary L2 |
| Base | 8453 | ✅ Ready | Coinbase L2 |
| Filecoin | 314 | ✅ Ready | Storage layer |
| Sepolia | 11155111 | ✅ Testnet | Ethereum testing |
| Base Sepolia | 84532 | ✅ Testnet | Base testing |
| Filecoin Calibration | 314159 | ✅ Testnet | Filecoin testing |

### Deployment Order

1. **Testnets First**: Deploy and test on all testnets
2. **Filecoin Calibration**: Test storage integration
3. **Base Sepolia**: Test L2 functionality
4. **Ethereum Sepolia**: Test mainnet compatibility
5. **Production**: Deploy to mainnets in order of importance

### Gas Optimization

```bash
# Estimate gas costs before deployment
npx hardhat run scripts/estimate-gas.js --network polygon

# Use gas reporter for optimization
REPORT_GAS=true npx hardhat test
```

## 🔐 Security Checklist

### Pre-Deployment Security

- [ ] **Private Key Security**: Use hardware wallet or secure key management
- [ ] **Contract Audits**: All contracts audited by reputable firms
- [ ] **Test Coverage**: >90% test coverage on all smart contracts
- [ ] **Testnet Validation**: Full functionality tested on testnets
- [ ] **Access Controls**: Proper role-based access implemented
- [ ] **Upgrade Mechanisms**: Secure upgrade paths defined
- [ ] **Emergency Procedures**: Pause/emergency stop mechanisms tested

### Post-Deployment Security

- [ ] **Contract Verification**: All contracts verified on block explorers
- [ ] **Monitoring Setup**: Real-time monitoring and alerts configured
- [ ] **Incident Response**: Emergency response procedures documented
- [ ] **Regular Audits**: Ongoing security audits scheduled
- [ ] **Bug Bounty**: Bug bounty program established

## 📊 Monitoring & Analytics

### Required Monitoring

1. **Smart Contract Events**: Monitor all contract interactions
2. **API Performance**: Track backend API response times
3. **Storage Usage**: Monitor IPFS/Filecoin storage utilization
4. **User Analytics**: Track user engagement and feature usage
5. **Error Tracking**: Comprehensive error logging and alerting

### Recommended Tools

- **Sentry**: Error tracking and performance monitoring
- **Mixpanel**: User analytics and feature tracking
- **Grafana**: Custom dashboards and metrics
- **PagerDuty**: Alert management and incident response

## 🚀 Production Deployment Steps

### Step 1: Final Testing

```bash
# Run full test suite
npm test

# Test contract interactions
npx hardhat test --network localhost

# Test frontend build
cd frontend && npm run build && npm run preview

# Test backend API
cd backend && npm test
```

### Step 2: Deploy Smart Contracts

```bash
# Deploy to production networks
npm run deploy:polygon
npm run deploy:base

# Verify contracts
npm run verify:polygon
npm run verify:base

# Update frontend with contract addresses
# (automatically done by deployment script)
```

### Step 3: Deploy Frontend

```bash
cd frontend

# Build optimized production bundle
npm run build

# Deploy to Vercel
vercel --prod

# Configure custom domain
vercel domains add zkvault.app
```

### Step 4: Deploy Backend

```bash
cd backend

# Deploy to your preferred service
# Example for Railway:
railway login
railway link
railway up

# Example for Render:
# Connect GitHub repo to Render dashboard
```

### Step 5: Configure DNS & SSL

```bash
# Configure DNS records
# A record: zkvault.app -> Vercel IP
# CNAME: api.zkvault.app -> backend-url

# SSL certificates are auto-managed by Vercel/Render
```

### Step 6: Post-Deployment Validation

```bash
# Test live application
curl https://api.zkvault.app/health

# Test contract interactions on mainnet
npx hardhat run scripts/test-deployment.js --network polygon

# Monitor initial transactions
# Check block explorers for contract activity
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy ZKVault Protocol

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: cd frontend && npm ci && npm run build
      - run: cd backend && npm ci && npm test

  deploy-contracts:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run deploy:polygon
        env:
          PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
          POLYGON_RPC_URL: ${{ secrets.POLYGON_RPC_URL }}

  deploy-frontend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend && npm ci && npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## 📈 Scaling Considerations

### Performance Optimization

1. **Frontend Optimization**
   - Code splitting and lazy loading
   - Image optimization and CDN usage
   - Service worker for offline functionality

2. **Backend Scaling**
   - Horizontal scaling with load balancers
   - Database read replicas
   - Redis caching layer

3. **Blockchain Optimization**
   - Gas optimization in smart contracts
   - Batch transactions where possible
   - Layer 2 solutions for high-frequency operations

### Cost Management

1. **Storage Costs**
   - Implement data lifecycle policies
   - Use appropriate storage tiers
   - Monitor and optimize storage usage

2. **API Costs**
   - Implement rate limiting
   - Cache frequently accessed data
   - Use free tiers where available

3. **Gas Costs**
   - Optimize contract interactions
   - Use meta-transactions for user experience
   - Implement gas price monitoring

## 🆘 Troubleshooting

### Common Issues

#### Contract Deployment Fails
```bash
# Check gas price and limits
npx hardhat run scripts/check-gas.js --network polygon

# Verify RPC endpoint
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $POLYGON_RPC_URL
```

#### Frontend Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check environment variables
npm run build -- --debug
```

#### Backend API Issues
```bash
# Check environment variables
node -e "console.log(process.env)"

# Test database connection
npm run test:db

# Check logs
tail -f logs/app.log
```

### Getting Help

1. **Documentation**: https://docs.zkvault.app
2. **GitHub Issues**: https://github.com/zkvault/protocol/issues
3. **Discord Support**: https://discord.gg/zkvault
4. **Email**: support@zkvault.app

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] API keys obtained and tested
- [ ] Smart contracts compiled successfully
- [ ] Frontend builds without errors
- [ ] Backend starts and responds to health checks

### Deployment
- [ ] Smart contracts deployed to all target networks
- [ ] Contracts verified on block explorers
- [ ] Frontend deployed and accessible
- [ ] Backend deployed and API responding
- [ ] DNS configured correctly
- [ ] SSL certificates active

### Post-Deployment
- [ ] All functionality tested on production
- [ ] Monitoring and alerts configured
- [ ] Documentation updated with live URLs
- [ ] Team notified of successful deployment
- [ ] Users can access and use the application
- [ ] No critical errors in logs

---

**Deployment completed successfully! 🎉**

For ongoing maintenance and updates, refer to the [Operations Guide](OPERATIONS.md).
