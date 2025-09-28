# ZKVault v2.0 Custom Identity Verification - Deployment Guide

This guide covers the deployment of ZKVault Protocol v2.0 with the new Custom Identity Verification system.

## 🎯 Overview

ZKVault v2.0 introduces a revolutionary custom identity verification system that replaces Self Protocol with a more flexible, powerful, and fully on-chain solution. This system supports 7 different verification methods and provides superior Sybil resistance.

## 📋 Prerequisites

### Required Software
- Node.js 18+ and npm
- Git
- MetaMask or compatible Web3 wallet
- Docker (for Akave Link API)

### Required API Keys
- **Blockchain RPCs**: Alchemy/Infura for Ethereum/Polygon, Base RPC, Filecoin Calibration
- **Storage Services**: Lighthouse API key, Akave Link setup, Synapse API key
- **Live Data APIs**: News API, AlphaVantage, Polygon.io, CoinGecko
- **Block Explorers**: Etherscan, Polygonscan, Basescan API keys (for verification)

## 🚀 Quick Deployment

### 1. Clone and Setup
```bash
git clone https://github.com/your-org/zkvault-custom-protocol.git
cd zkvault-custom-protocol

# Install all dependencies
npm run install:all
```

### 2. Environment Configuration
```bash
# Copy environment templates
cp .env.example .env
cp frontend/.env.example frontend/.env

# Edit .env files with your configuration
nano .env
nano frontend/.env
```

### 3. Deploy Contracts
```bash
# Deploy to all testnets
npm run deploy:all-testnets

# Or deploy to specific networks
npm run deploy:sepolia
npm run deploy:base-sepolia
npm run deploy:polygon-mumbai
npm run deploy:filecoin
```

### 4. Start Application
```bash
# Start both frontend and backend
npm run dev
```

## 🔧 Detailed Setup

### Environment Variables

#### Root `.env` file:
```bash
# Deployment
PRIVATE_KEY="your_private_key_without_0x"

# Blockchain RPCs
ETHEREUM_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
POLYGON_RPC_URL="https://polygon-mumbai.g.alchemy.com/v2/YOUR_KEY"
BASE_RPC_URL="https://sepolia.base.org"
FILECOIN_CALIBRATION_RPC_URL="https://api.calibration.node.glif.io/rpc/v1"

# Block Explorer API Keys
ETHERSCAN_API_KEY="your_etherscan_key"
POLYGONSCAN_API_KEY="your_polygonscan_key"
BASESCAN_API_KEY="your_basescan_key"
```

#### Frontend `.env` file:
```bash
# Contract Addresses (auto-generated after deployment)
VITE_CUSTOM_IDENTITY_VERIFIER_ADDRESS="0x..."
VITE_ZKVAULT_CUSTOM_ADDRESS="0x..."
VITE_DATA_COIN_ADDRESS="0x..."
VITE_DATA_DAO_ADDRESS="0x..."
VITE_AIRDROP_GATING_ADDRESS="0x..."

# Storage Services
VITE_LIGHTHOUSE_API_KEY="your_lighthouse_key"
VITE_AKAVE_API_URL="http://localhost:8000"
VITE_SYNAPSE_API_KEY="your_synapse_key"

# Live Data APIs
VITE_NEWS_API_KEY="your_news_api_key"
VITE_ALPHAVANTAGE_API_KEY="your_alphavantage_key"
VITE_POLYGON_API_KEY="your_polygon_io_key"
VITE_COINGECKO_API_KEY="your_coingecko_key"
```

## 🏗️ Contract Deployment Details

### Deployment Order
1. **CustomIdentityVerification** - Core verification system
2. **ZKVaultCustom** - Main protocol (requires identity verifier address)
3. **DataCoin** - ERC-20 governance token
4. **DataDAO** - Governance system (requires DataCoin address)
5. **AirdropGating** - Airdrop system (requires identity verifier address)
6. **GasPoolDAO** - Gas management (requires DataCoin address)
7. **PrivacyAuditSystem** - Audit logging

### Network-Specific Configurations

#### Ethereum Sepolia
- Chain ID: 11155111
- Gas Price: Auto (EIP-1559)
- Block Explorer: https://sepolia.etherscan.io

#### Base Sepolia
- Chain ID: 84532
- Gas Price: Auto
- Block Explorer: https://sepolia.basescan.org

#### Polygon Mumbai
- Chain ID: 80001
- Gas Price: 30 gwei
- Block Explorer: https://mumbai.polygonscan.com

#### Filecoin Calibration
- Chain ID: 314159
- Gas Price: Auto
- Block Explorer: https://calibration.filfox.info

## 🆔 Custom Identity Verification System

### Verification Methods

1. **Social Verification (200 points)**
   - Requires 3+ verified community vouchers
   - Vouchers must be previously verified users
   - Prevents Sybil attacks through social graph

2. **Activity-Based Verification (150 points)**
   - Analyzes on-chain transaction patterns
   - Considers transaction count, contract interactions, time active
   - Rewards genuine blockchain usage

3. **Stake-Based Verification (100 points)**
   - Requires minimum 0.1 ETH stake
   - Economic incentive for honest behavior
   - Stake can be withdrawn after verification expires

4. **Biometric ZK Proofs (250 points)**
   - Privacy-preserving biometric verification
   - Uses zero-knowledge proofs to protect biometric data
   - Highest security verification method

5. **Multi-Signature Verification (300 points)**
   - Requires signatures from 2+ trusted verifiers
   - Institutional-grade verification
   - Highest point value for maximum trust

6. **Time-Lock Verification (50 points)**
   - Commitment-based verification
   - Requires time-locked commitment
   - Prevents rushed or automated verification

7. **Cross-Chain Verification (200 points)**
   - Verifies identity across multiple blockchains
   - Uses Merkle proofs for cross-chain validation
   - Enhances identity portability

### Scoring System
- **Minimum Score**: 100 points required for verification
- **Maximum Score**: 1000 points total possible
- **Flexible Combinations**: Users can mix methods to reach minimum
- **Weighted Scoring**: Different methods have different point values

## 🎯 Frontend Integration

### New Components
- **CustomIdentityVerification.jsx** - Main verification interface
- **customIdentityService.js** - Web3 integration service

### Key Features
- Multi-method verification selection
- Real-time score calculation
- Social voucher management
- Stake management interface
- Verification status tracking
- Dispute resolution interface

## 🔍 Testing and Validation

### Pre-Deployment Testing
```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Check gas usage
REPORT_GAS=true npm run test
```

### Post-Deployment Validation
```bash
# Validate hackathon requirements
npm run validate-hackathon

# Verify contracts on block explorers
npm run verify:sepolia
npm run verify:base
npm run verify:filecoin
```

## 🚀 Production Deployment

### Mainnet Deployment
```bash
# Deploy to mainnet (ensure sufficient ETH for gas)
npm run deploy:mainnet
npm run deploy:polygon
npm run deploy:base-mainnet
npm run deploy:filecoin-mainnet
```

### Security Considerations
1. **Private Key Security**: Use hardware wallets for mainnet
2. **Contract Verification**: Always verify contracts on block explorers
3. **Multi-sig Setup**: Use multi-sig wallets for contract ownership
4. **Gradual Rollout**: Start with limited functionality and expand
5. **Audit Requirements**: Consider professional security audits

## 📊 Monitoring and Maintenance

### Key Metrics to Monitor
- Verification success rates by method
- User adoption and retention
- Gas usage optimization
- Storage utilization (Lighthouse, Akave, Synapse)
- Live data feed reliability

### Maintenance Tasks
- Regular contract upgrades (if using proxy patterns)
- Trusted verifier management
- Method weight adjustments based on performance
- Storage service health monitoring

## 🆘 Troubleshooting

### Common Issues

#### Deployment Failures
- **Insufficient Gas**: Increase gas limit in hardhat.config.js
- **RPC Errors**: Check RPC URL and API key validity
- **Nonce Issues**: Clear transaction pool or adjust nonce

#### Frontend Issues
- **Contract Connection**: Verify contract addresses in .env
- **Web3 Provider**: Ensure MetaMask is connected to correct network
- **API Failures**: Check API keys and rate limits

#### Verification Issues
- **Low Scores**: Combine multiple verification methods
- **Social Vouchers**: Ensure vouchers are verified users
- **Stake Requirements**: Minimum 0.1 ETH required for stake verification

### Support Resources
- GitHub Issues: https://github.com/zkvault/custom-protocol/issues
- Documentation: https://docs.zkvault.app
- Discord: https://discord.gg/zkvault

## 🎉 Success Checklist

- [ ] All contracts deployed successfully
- [ ] Contract addresses updated in frontend .env
- [ ] Frontend connects to contracts
- [ ] Identity verification system functional
- [ ] Storage services (Lighthouse, Akave, Synapse) working
- [ ] Live data feeds operational
- [ ] Airdrop system functional
- [ ] All tests passing
- [ ] Contracts verified on block explorers
- [ ] Documentation updated

## 🔗 Additional Resources

- **Smart Contract Documentation**: See `/contracts/` folder
- **Frontend Documentation**: See `/frontend/README.md`
- **Backend Documentation**: See `/backend/README.md`
- **API Reference**: See deployed contract ABIs
- **Hackathon Compliance**: See `validation-report.json`

---

**Congratulations! You've successfully deployed ZKVault v2.0 with Custom Identity Verification! 🎉**
