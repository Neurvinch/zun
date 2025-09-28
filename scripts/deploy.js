const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Deployment configuration for different networks
const DEPLOYMENT_CONFIG = {
  // Ethereum Sepolia
  sepolia: {
    selfVerificationHub: "0x0000000000000000000000000000000000000000", // Replace with actual Self Protocol address
    scope: 12345,
    gasPrice: ethers.utils.parseUnits("20", "gwei"),
  },
  // Base Sepolia
  baseSepolia: {
    selfVerificationHub: "0x0000000000000000000000000000000000000000", // Replace with actual Self Protocol address
    scope: 12345,
    gasPrice: ethers.utils.parseUnits("0.1", "gwei"),
  },
  // Polygon Mumbai
  polygonMumbai: {
    selfVerificationHub: "0x0000000000000000000000000000000000000000", // Replace with actual Self Protocol address
    scope: 12345,
    gasPrice: ethers.utils.parseUnits("30", "gwei"),
  },
  // Filecoin Calibration
  filecoinCalibration: {
    selfVerificationHub: "0x0000000000000000000000000000000000000000", // Replace with actual Self Protocol address
    scope: 12345,
    gasPrice: ethers.utils.parseUnits("1", "gwei"),
  },
  // Default for other networks
  default: {
    selfVerificationHub: "0x0000000000000000000000000000000000000000",
    scope: 12345,
    gasPrice: ethers.utils.parseUnits("20", "gwei"),
  }
};

async function main() {
  console.log(`\n🚀 Deploying ZKVault contracts to ${network.name}...`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying with account: ${deployer.address}`);
  
  const balance = await deployer.getBalance();
  console.log(`💰 Account balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Get network configuration
  const config = DEPLOYMENT_CONFIG[network.name] || DEPLOYMENT_CONFIG.default;
  console.log(`⚙️  Network config:`, config);
  
  const deployedContracts = {};
  
  try {
    // 1. Deploy DataCoin (ERC20 governance token)
    console.log("\n📄 Deploying DataCoin...");
    const DataCoin = await ethers.getContractFactory("DataCoin");
    const dataCoin = await DataCoin.deploy(
      "ZKVault DataCoin",
      "ZKDC",
      ethers.utils.parseEther("1000000"), // 1M initial supply
      { gasPrice: config.gasPrice }
    );
    await dataCoin.deployed();
    deployedContracts.DataCoin = dataCoin.address;
    console.log(`✅ DataCoin deployed to: ${dataCoin.address}`);
    
    // 2. Deploy DataDAO
    console.log("\n📄 Deploying DataDAO...");
    const DataDAO = await ethers.getContractFactory("DataDAO");
    const dataDAO = await DataDAO.deploy(
      dataCoin.address,
      deployer.address, // treasury
      { gasPrice: config.gasPrice }
    );
    await dataDAO.deployed();
    deployedContracts.DataDAO = dataDAO.address;
    console.log(`✅ DataDAO deployed to: ${dataDAO.address}`);
    
    // 3. Deploy GasPoolDAO
    console.log("\n📄 Deploying GasPoolDAO...");
    const GasPoolDAO = await ethers.getContractFactory("GasPoolDAO");
    const gasPoolDAO = await GasPoolDAO.deploy(
      dataCoin.address,
      deployer.address, // treasury
      { gasPrice: config.gasPrice }
    );
    await gasPoolDAO.deployed();
    deployedContracts.GasPoolDAO = gasPoolDAO.address;
    console.log(`✅ GasPoolDAO deployed to: ${gasPoolDAO.address}`);
    
    // 4. Deploy ZKVaultWithSelf
    console.log("\n📄 Deploying ZKVaultWithSelf...");
    const ZKVaultWithSelf = await ethers.getContractFactory("ZKVaultWithSelf");
    const zkVault = await ZKVaultWithSelf.deploy(
      config.selfVerificationHub,
      config.scope,
      { gasPrice: config.gasPrice }
    );
    await zkVault.deployed();
    deployedContracts.ZKVaultWithSelf = zkVault.address;
    console.log(`✅ ZKVaultWithSelf deployed to: ${zkVault.address}`);
    
    // 5. Deploy PrivacyAuditSystem
    console.log("\n📄 Deploying PrivacyAuditSystem...");
    const PrivacyAuditSystem = await ethers.getContractFactory("PrivacyAuditSystem");
    const privacyAudit = await PrivacyAuditSystem.deploy(
      deployer.address, // auditor
      { gasPrice: config.gasPrice }
    );
    await privacyAudit.deployed();
    deployedContracts.PrivacyAuditSystem = privacyAudit.address;
    console.log(`✅ PrivacyAuditSystem deployed to: ${privacyAudit.address}`);
    
    // 6. Deploy AirdropGating
    console.log("\n📄 Deploying AirdropGating...");
    const AirdropGating = await ethers.getContractFactory("AirdropGating");
    const airdropGating = await AirdropGating.deploy(
      zkVault.address, // verification contract
      dataCoin.address, // reward token
      { gasPrice: config.gasPrice }
    );
    await airdropGating.deployed();
    deployedContracts.AirdropGating = airdropGating.address;
    console.log(`✅ AirdropGating deployed to: ${airdropGating.address}`);
    
    // Post-deployment setup
    console.log("\n⚙️  Setting up contract permissions...");
    
    // Grant DataDAO minter role for DataCoin
    const MINTER_ROLE = await dataCoin.MINTER_ROLE();
    await dataCoin.grantRole(MINTER_ROLE, dataDAO.address);
    console.log("✅ Granted DataDAO minter role for DataCoin");
    
    // Grant AirdropGating minter role for DataCoin
    await dataCoin.grantRole(MINTER_ROLE, airdropGating.address);
    console.log("✅ Granted AirdropGating minter role for DataCoin");
    
    // Transfer some DataCoins to contracts for rewards
    await dataCoin.transfer(dataDAO.address, ethers.utils.parseEther("100000"));
    await dataCoin.transfer(airdropGating.address, ethers.utils.parseEther("50000"));
    console.log("✅ Transferred DataCoins to contracts for rewards");
    
    // Save deployment addresses
    const deploymentData = {
      network: network.name,
      chainId: network.config.chainId,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deployedContracts,
      config: config,
      gasUsed: {
        // Will be populated by individual contract deployments
      }
    };
    
    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    // Save deployment data
    const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log(`\n📁 Deployment data saved to: ${deploymentFile}`);
    
    // Update frontend environment variables
    await updateFrontendEnv(deployedContracts, network.name);
    
    // Print summary
    console.log("\n🎉 Deployment Summary:");
    console.log("========================");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`${name}: ${address}`);
    });
    
    console.log("\n🔗 Network Information:");
    console.log(`Network: ${network.name}`);
    console.log(`Chain ID: ${network.config.chainId}`);
    console.log(`Deployer: ${deployer.address}`);
    
    if (network.name !== "hardhat" && network.name !== "localhost") {
      console.log("\n📋 Next Steps:");
      console.log("1. Verify contracts on block explorer");
      console.log("2. Update frontend environment variables");
      console.log("3. Test contract interactions");
      console.log("4. Set up monitoring and alerts");
      
      console.log("\n🔍 Verification Commands:");
      Object.entries(deployedContracts).forEach(([name, address]) => {
        console.log(`npx hardhat verify --network ${network.name} ${address}`);
      });
    }
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

async function updateFrontendEnv(contracts, networkName) {
  try {
    const envPath = path.join(__dirname, "..", "frontend", ".env");
    const envExamplePath = path.join(__dirname, "..", "frontend", ".env.example");
    
    let envContent = "";
    
    // Read existing .env or .env.example
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    } else if (fs.existsSync(envExamplePath)) {
      envContent = fs.readFileSync(envExamplePath, "utf8");
    }
    
    // Update contract addresses for the deployed network
    const networkSuffix = networkName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    
    Object.entries(contracts).forEach(([contractName, address]) => {
      const envVar = `VITE_${contractName.toUpperCase()}_${networkSuffix}`;
      const regex = new RegExp(`^${envVar}=.*$`, "m");
      
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${envVar}=${address}`);
      } else {
        envContent += `\n${envVar}=${address}`;
      }
    });
    
    // Write updated .env file
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated frontend .env file with ${networkName} contract addresses`);
    
  } catch (error) {
    console.warn("⚠️  Failed to update frontend .env file:", error.message);
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main, DEPLOYMENT_CONFIG };
