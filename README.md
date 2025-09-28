# ZKVault Protocol

**Privacy-Preserving DeFi Swaps with Self Protocol Integration**

ZKVault is a comprehensive DeFi protocol that combines zero-knowledge proofs for shielded swaps, onchain human verification via Self Protocol, and encrypted off-chain receipt storage using Filecoin/IPFS. The protocol integrates multiple cutting-edge technologies to create a privacy-first, Sybil-resistant trading environment.

## 🌟 Features

### Core Protocol Features
- **🔒 Zero-Knowledge Shielded Swaps**: Privacy-preserving token swaps using zk-SNARKs
- **👤 Human Verification**: Sybil-resistant identity verification via Self Protocol
- **📦 Decentralized Storage**: Encrypted receipt storage on Filecoin/IPFS via Lighthouse and Synapse
- **🤖 AI/ML Analytics**: Dataset storage and analytics via Akave O3 S3-compatible API
- **📊 Live Data Feeds**: Real-world data integration with zkTLS cryptographic proofs
- **🏛️ DataDAO Governance**: Community-driven data sharing and monetization
- **⛽ Gasless Transactions**: Meta-transactions via Gelato relayer network
- **🎯 Airdrop Gating**: Verified-human-only token distributions

### Technology Stack
- **Smart Contracts**: Solidity 0.8.19 with OpenZeppelin
- **Frontend**: React 19 + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **Blockchain**: Ethereum, Polygon, Base, Filecoin
- **Storage**: Lighthouse (IPFS/Filecoin), Akave O3, Synapse SDK
- **Identity**: Self Protocol for human verification
- **Privacy**: Circom + SnarkJS for zero-knowledge proofs
- **Data**: zkTLS for verifiable real-world data feeds

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git
- MetaMask or compatible Web3 wallet

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/zkvault-protocol.git
   cd zkvault-protocol
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies (Hardhat, etc.)
   npm install
   
   # Install frontend dependencies
   cd frontend && npm install && cd ..
   
   # Install backend dependencies
   cd backend && npm install && cd ..
   ```

3. **Environment setup**
   ```bash
   # Copy environment template
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   
   # Edit .env files with your configuration
   # See "Configuration" section below for details
   ```

4. **Compile smart contracts**
   ```bash
   npm run compile
   ```

5. **Setup Akave Link API (for Akave track)**
   ```bash
   # Pull Akave Link Docker image
   docker pull akave/akavelink:latest
   
   # Run Akave Link container
   docker run -p 8000:8000 akave/akavelink:latest
   
   # Get wallet address and funds from faucet
   # Visit: https://faucet.akave.ai
   ```

6. **Start development environment**
   ```bash
   # Start both frontend and backend
   npm run dev
   
   # Or start individually:
   npm run frontend:dev  # Frontend only
   npm run backend:dev   # Backend only
   ```

7. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## 📋 Configuration

### ⚠️ IMPORTANT: Real API Keys Required

**All mock data has been removed from the application. The following API keys are REQUIRED for the application to function:**

1. **Blockchain RPCs**
   - Alchemy or Infura for Ethereum/Polygon
   - Base RPC endpoint
   - Filecoin Calibration testnet RPC

2. **Storage Services**
   - Lighthouse API key (for IPFS/Filecoin storage)
   - Akave Link API setup (for native Akave decentralized storage)
   - Synapse API key (for Filecoin warm storage)

3. **Live Data APIs (REQUIRED - No Mock Fallbacks)**
   - News API key (for news sentiment analysis) - **REQUIRED**
   - AlphaVantage API key (for financial data) - **REQUIRED**
   - Polygon.io API key (for market data) - **REQUIRED**
   - CoinGecko API (free tier available)

4. **Self Protocol**
   - Self Protocol app configuration
   - Verification hub contract addresses

### Environment Variables

Key environment variables to configure:

```bash
# Deployment
PRIVATE_KEY="your_private_key_here"
ETHEREUM_RPC_URL="your_ethereum_rpc_url"
POLYGON_RPC_URL="your_polygon_rpc_url"
BASE_RPC_URL="your_base_rpc_url"
FILECOIN_CALIBRATION_RPC_URL="your_filecoin_rpc_url"

# Storage
LIGHTHOUSE_API_KEY="your_lighthouse_api_key"
VITE_AKAVE_API_URL="http://localhost:8000"
VITE_AKAVE_WALLET_ADDRESS="your_akave_wallet_address"
SYNAPSE_API_KEY="your_synapse_api_key"

# Live Data
NEWS_API_KEY="your_news_api_key"
GELATO_API_KEY="your_gelato_api_key"

# Self Protocol
SELF_APP_NAME="ZKVault Protocol"
SELF_SCOPE="zkvault-human-verification"
```

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │ Smart Contracts │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Solidity)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Storage Layer   │    │  Data Feeds     │    │   Identity      │
│ (IPFS/Filecoin) │    │   (zkTLS)       │    │ (Self Protocol) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Smart Contracts

1. **ZKVaultWithSelf.sol**: Main protocol contract with Self Protocol integration
2. **DataDAO.sol**: Decentralized data sharing and governance
3. **DataCoin.sol**: ERC-20 governance token with voting capabilities
4. **GasPoolDAO.sol**: Gasless transaction funding and management
5. **PrivacyAuditSystem.sol**: Privacy compliance and audit logging
6. **AirdropGating.sol**: Verified-human-only token distributions

### Data Flow

1. **User Authentication**: Self Protocol verifies human identity
2. **Swap Initiation**: User initiates privacy-preserving swap
3. **ZK Proof Generation**: Client generates zero-knowledge proof
4. **Transaction Execution**: Relayer submits transaction with proofs
5. **Receipt Storage**: Encrypted receipt stored on Filecoin/IPFS
6. **Data Analytics**: Anonymized data contributed to DataDAO

## 🔧 Development

### Smart Contract Development

```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Deploy to local network
npm run deploy:localhost

# Deploy to testnets
npm run deploy:sepolia
npm run deploy:baseSepolia
npm run deploy:filecoin
```

### Frontend Development

```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend Development

```bash
cd backend

# Start development server
npm run dev

# Run in production mode
npm start
```

## 🚀 Deployment

### Contract Deployment

Deploy contracts to all supported networks:

```bash
# Deploy to all testnets
npm run deploy:all-testnets

# Deploy to specific networks
npm run deploy:sepolia
npm run deploy:baseSepolia
npm run deploy:filecoin

# Verify contracts
npm run verify:sepolia
npm run verify:base
npm run verify:filecoin
```

### Frontend Deployment

The frontend can be deployed to Vercel, Netlify, or any static hosting service:

```bash
cd frontend
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy to Netlify
netlify deploy --prod --dir=dist
```

### Backend Deployment

Deploy the backend to any Node.js hosting service:

```bash
cd backend
npm run build  # If you have a build step
npm start      # Production start
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run contract tests only
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run coverage
npx hardhat coverage
```

### Test Networks

The protocol is deployed and tested on:

- **Ethereum Sepolia**: For Ethereum compatibility testing
- **Base Sepolia**: For Base L2 functionality
- **Polygon Mumbai**: For Polygon scaling features
- **Filecoin Calibration**: For Filecoin storage integration

## 📚 API Reference

### Smart Contract APIs

#### ZKVaultWithSelf

```solidity
// Verify user identity
function verifyIdentityManual(string memory nationality, bytes calldata proof) external

// Execute verified swap
function swapWithVerifiedUser(address tokenIn, address tokenOut, uint256 amountIn) external

// Check verification status
function isUserVerified(address user) public view returns (bool)
```

#### DataDAO

```solidity
// Contribute data to DAO
function contributeData(string memory dataHash, uint8 dataType, bytes32 merkleRoot) external

// Claim rewards
function claimRewards() external

// Create governance proposal
function createProposal(string memory title, string memory description) external
```

### REST API Endpoints

#### Backend API

```
GET  /api/health              - Health check
POST /api/swap/estimate       - Estimate swap parameters
POST /api/swap/execute        - Execute swap with proofs
GET  /api/data/feeds          - Get live data feeds
POST /api/data/contribute     - Contribute to DataDAO
GET  /api/storage/files       - List stored files
POST /api/storage/upload      - Upload to decentralized storage
```

## 🔐 Security

### Security Features

- **Zero-Knowledge Proofs**: Privacy-preserving transaction validation
- **Identity Verification**: Sybil resistance via Self Protocol
- **Encrypted Storage**: AES-GCM encryption for sensitive data
- **Access Control**: Role-based permissions in smart contracts
- **Audit Logging**: Comprehensive privacy audit system

### Security Best Practices

1. **Private Key Management**: Never commit private keys to version control
2. **Environment Variables**: Use environment variables for sensitive configuration
3. **Smart Contract Audits**: All contracts should be audited before mainnet deployment
4. **Input Validation**: Validate all user inputs on both frontend and backend
5. **Rate Limiting**: Implement rate limiting for API endpoints

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Style

- **Solidity**: Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- **JavaScript/React**: Use ESLint and Prettier configurations
- **Documentation**: Update README and inline comments for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Website**: https://zkvault.app
- **Documentation**: https://docs.zkvault.app
- **Discord**: https://discord.gg/zkvault
- **Twitter**: https://twitter.com/zkvault_app
- **GitHub**: https://github.com/zkvault/protocol

## 🏆 Hackathon Compliance

This project meets all requirements for the following hackathons:

### Akave Track
- ✅ **S3-Compatible API Usage**: AI/ML datasets stored via Akave O3
- ✅ **Innovation**: Decentralized analytics storage for DeFi
- ✅ **Realism**: Practical use case for trading analytics

### Lighthouse Track
- ✅ **Lighthouse SDK Integration**: Data tokenization and storage
- ✅ **DataDAO Implementation**: Community data sharing with DataCoins
- ✅ **Live Data Integration**: Real-world API feeds with zkTLS validation
- ✅ **Mainnet Deployment**: Deployed to Base, Polygon, Filecoin networks

### Synapse Track
- ✅ **Synapse SDK Usage**: Filecoin warm storage integration
- ✅ **USDFC Payments**: Storage fees paid with USDFC tokens
- ✅ **Calibration Testnet**: Deployed to Filecoin Calibration
- ✅ **Working Demo**: Full frontend demo deployed

## 🆘 Support

If you need help:

1. Check the [Documentation](https://docs.zkvault.app)
2. Search [GitHub Issues](https://github.com/zkvault/protocol/issues)
3. Join our [Discord](https://discord.gg/zkvault)
4. Create a new issue with detailed information

## 🙏 Acknowledgments

- **Self Protocol** for identity verification infrastructure
- **Lighthouse** for IPFS/Filecoin storage solutions
- **Akave** for S3-compatible decentralized storage
- **Synapse** for Filecoin warm storage and payment rails
- **OpenZeppelin** for secure smart contract libraries
- **1inch** for DEX aggregation capabilities
- **Gelato** for gasless transaction infrastructure

---

**Built with ❤️ by the ZKVault Team**
