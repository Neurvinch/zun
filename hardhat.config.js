import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL || "https://eth-mainnet.alchemyapi.io/v2/your-api-key",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-mainnet.alchemyapi.io/v2/your-api-key",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
    },
    filecoin: {
      url: process.env.FILECOIN_RPC_URL || "https://api.calibration.node.glif.io/rpc/v1",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 314159,
    },
    // Testnets
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.alchemyapi.io/v2/your-api-key",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || "https://polygon-mumbai.alchemyapi.io/v2/your-api-key",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80001,
    },
    baseGoerli: {
      url: process.env.BASE_GOERLI_RPC_URL || "https://goerli.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84531,
    },
    calibration: {
      url: process.env.FILECOIN_CALIBRATION_RPC_URL || "https://api.calibration.node.glif.io/rpc/v1",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 314159,
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      ethereum: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
      filecoin: process.env.FILFOX_API_KEY,
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "filecoin",
        chainId: 314159,
        urls: {
          apiURL: "https://calibration.filfox.info/api/v1",
          browserURL: "https://calibration.filfox.info"
        }
      }
    ]
  },
};

export default config;
