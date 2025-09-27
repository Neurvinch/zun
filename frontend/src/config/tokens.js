// Production token configurations for different chains

export const TOKEN_ADDRESSES = {
  // Ethereum Mainnet (1)
  1: {
    USDC: '0xA0b86a33E6441b8435b662303C0f479c7a45d4C1',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
  },
  
  // Ethereum Sepolia Testnet (11155111)
  11155111: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    DAI: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
    WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
  },
  
  // Celo Mainnet (42220)
  42220: {
    cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
    CELO: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    USDT: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'
  },
  
  // Celo Alfajores Testnet (44787)
  44787: {
    cUSD: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
    cEUR: '0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F',
    CELO: '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9',
    USDC: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
    USDT: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'
  },
  
  // Polygon Mainnet (137)
  137: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
  },
  
  // Arbitrum One (42161)
  42161: {
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548'
  }
};

export const TOKEN_METADATA = {
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    icon: '💵',
    category: 'stablecoin'
  },
  USDT: {
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    icon: '💵',
    category: 'stablecoin'
  },
  DAI: {
    name: 'Dai Stablecoin',
    symbol: 'DAI',
    decimals: 18,
    icon: '💵',
    category: 'stablecoin'
  },
  WETH: {
    name: 'Wrapped Ether',
    symbol: 'WETH',
    decimals: 18,
    icon: '⚡',
    category: 'crypto'
  },
  WBTC: {
    name: 'Wrapped Bitcoin',
    symbol: 'WBTC',
    decimals: 8,
    icon: '₿',
    category: 'crypto'
  },
  cUSD: {
    name: 'Celo Dollar',
    symbol: 'cUSD',
    decimals: 18,
    icon: '💵',
    category: 'stablecoin'
  },
  cEUR: {
    name: 'Celo Euro',
    symbol: 'cEUR',
    decimals: 18,
    icon: '💶',
    category: 'stablecoin'
  },
  CELO: {
    name: 'Celo',
    symbol: 'CELO',
    decimals: 18,
    icon: '🌱',
    category: 'crypto'
  },
  WMATIC: {
    name: 'Wrapped Matic',
    symbol: 'WMATIC',
    decimals: 18,
    icon: '🔷',
    category: 'crypto'
  },
  ARB: {
    name: 'Arbitrum',
    symbol: 'ARB',
    decimals: 18,
    icon: '🔵',
    category: 'crypto'
  }
};

// Swap limits and configurations
export const SWAP_LIMITS = {
  // Minimum balance required (in token units)
  MIN_BALANCE: {
    stablecoin: '10', // 10 stablecoins
    crypto: '0.01'    // 0.01 crypto tokens
  },
  
  // Maximum swap amounts (in token units)
  MAX_SWAP: {
    stablecoin: '10000', // 10,000 stablecoins
    crypto: '100'        // 100 crypto tokens
  },
  
  // Minimum swap amounts (in token units)
  MIN_SWAP: {
    stablecoin: '1',   // 1 stablecoin
    crypto: '0.001'    // 0.001 crypto tokens
  }
};

// ZKVault contract addresses (to be deployed)
export const ZKVAULT_CONTRACTS = {
  1: '0x0000000000000000000000000000000000000000',        // Ethereum Mainnet
  11155111: '0x0000000000000000000000000000000000000000',   // Sepolia
  44787: '0x0000000000000000000000000000000000000000',     // Celo Alfajores
  137: '0x0000000000000000000000000000000000000000',       // Polygon
  42161: '0x0000000000000000000000000000000000000000'      // Arbitrum
};

// Self Protocol ProofOfHuman contract addresses
export const getSelfProtocolContract = (chainId) => {
    const contracts = {
        1: import.meta.env.VITE_SELF_CONTRACT_ETHEREUM_MAINNET || '0x0000000000000000000000000000000000000000', // Ethereum Mainnet
        11155111: import.meta.env.VITE_SELF_CONTRACT_ETHEREUM_SEPOLIA || '0x0000000000000000000000000000000000000000', // Ethereum Sepolia
        42220: import.meta.env.VITE_SELF_CONTRACT_CELO_MAINNET || '0x0000000000000000000000000000000000000000', // Celo Mainnet
        44787: import.meta.env.VITE_SELF_CONTRACT_CELO_SEPOLIA || '0x0000000000000000000000000000000000000000', // Celo Sepolia
        137: '0x0000000000000000000000000000000000000000', // Polygon (not supported yet)
        42161: '0x0000000000000000000000000000000000000000', // Arbitrum (not supported yet)
    };
    
    return contracts[chainId] || '0x0000000000000000000000000000000000000000';
};

// Self Protocol Hub addresses (official)
export const getSelfHubAddress = (chainId) => {
    const hubs = {
        42220: '0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF', // Celo Mainnet
        44787: '0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74', // Celo Sepolia
        11155111: '0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74', // Ethereum Sepolia (for testing)
    };
    
    return hubs[chainId] || '0x0000000000000000000000000000000000000000';
};
/**
 * Get token metadata
 * @param {string} symbol - Token symbol
 * @returns {Object} - Token metadata
 */
export function getTokenMetadata(symbol) {
  return TOKEN_METADATA[symbol] || {
    name: symbol,
    symbol: symbol,
    decimals: 18,
    icon: '🪙',
    category: 'unknown'
  };
}

/**
 * Get swap limits for a token
 * @param {string} symbol - Token symbol
 * @returns {Object} - Swap limits
 */
export function getSwapLimits(symbol) {
  const metadata = getTokenMetadata(symbol);
  const category = metadata.category;
  
  return {
    minBalance: SWAP_LIMITS.MIN_BALANCE[category] || SWAP_LIMITS.MIN_BALANCE.crypto,
    maxSwap: SWAP_LIMITS.MAX_SWAP[category] || SWAP_LIMITS.MAX_SWAP.crypto,
    minSwap: SWAP_LIMITS.MIN_SWAP[category] || SWAP_LIMITS.MIN_SWAP.crypto
  };
}

/**
 * Check if a token is supported on a chain
 * @param {string} symbol - Token symbol
 * @param {number} chainId - Chain ID
 * @returns {boolean} - True if supported
 */
export function isTokenSupported(symbol, chainId) {
  const tokens = getSupportedTokens(chainId);
  return tokens.hasOwnProperty(symbol);
}

/**
 * Get ZKVault contract address for a chain
 * @param {number} chainId - Chain ID
 * @returns {string} - Contract address
 */
export function getZKVaultContract(chainId) {
  return ZKVAULT_CONTRACTS[chainId] || '0x0000000000000000000000000000000000000000';
}

/**
 * Get supported tokens for a chain
 * @param {number} chainId - Chain ID
 * @returns {Object} - Supported tokens
 */
export function getSupportedTokens(chainId) {
  return TOKEN_ADDRESSES[chainId] || {};
}
