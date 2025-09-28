const { ethers, network, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log(`\n🔍 Verifying contracts on ${network.name}...`);
  
  // Load deployment data
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ No deployment file found for ${network.name}`);
    console.log(`Expected file: ${deploymentFile}`);
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const contracts = deploymentData.contracts;
  const config = deploymentData.config;
  
  console.log(`📄 Loaded deployment data for ${Object.keys(contracts).length} contracts`);
  
  try {
    // Verify DataCoin
    if (contracts.DataCoin) {
      console.log("\n🔍 Verifying DataCoin...");
      await run("verify:verify", {
        address: contracts.DataCoin,
        constructorArguments: [
          "ZKVault DataCoin",
          "ZKDC",
          ethers.utils.parseEther("1000000")
        ],
      });
      console.log("✅ DataCoin verified");
    }
    
    // Verify DataDAO
    if (contracts.DataDAO && contracts.DataCoin) {
      console.log("\n🔍 Verifying DataDAO...");
      await run("verify:verify", {
        address: contracts.DataDAO,
        constructorArguments: [
          contracts.DataCoin,
          deploymentData.deployer
        ],
      });
      console.log("✅ DataDAO verified");
    }
    
    // Verify GasPoolDAO
    if (contracts.GasPoolDAO && contracts.DataCoin) {
      console.log("\n🔍 Verifying GasPoolDAO...");
      await run("verify:verify", {
        address: contracts.GasPoolDAO,
        constructorArguments: [
          contracts.DataCoin,
          deploymentData.deployer
        ],
      });
      console.log("✅ GasPoolDAO verified");
    }
    
    // Verify ZKVaultWithSelf
    if (contracts.ZKVaultWithSelf) {
      console.log("\n🔍 Verifying ZKVaultWithSelf...");
      await run("verify:verify", {
        address: contracts.ZKVaultWithSelf,
        constructorArguments: [
          config.selfVerificationHub,
          config.scope
        ],
      });
      console.log("✅ ZKVaultWithSelf verified");
    }
    
    // Verify PrivacyAuditSystem
    if (contracts.PrivacyAuditSystem) {
      console.log("\n🔍 Verifying PrivacyAuditSystem...");
      await run("verify:verify", {
        address: contracts.PrivacyAuditSystem,
        constructorArguments: [
          deploymentData.deployer
        ],
      });
      console.log("✅ PrivacyAuditSystem verified");
    }
    
    // Verify AirdropGating
    if (contracts.AirdropGating && contracts.ZKVaultWithSelf && contracts.DataCoin) {
      console.log("\n🔍 Verifying AirdropGating...");
      await run("verify:verify", {
        address: contracts.AirdropGating,
        constructorArguments: [
          contracts.ZKVaultWithSelf,
          contracts.DataCoin
        ],
      });
      console.log("✅ AirdropGating verified");
    }
    
    console.log("\n🎉 All contracts verified successfully!");
    
    // Update deployment data with verification status
    deploymentData.verified = true;
    deploymentData.verifiedAt = new Date().toISOString();
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    
    if (error.message.includes("Already Verified")) {
      console.log("ℹ️  Some contracts may already be verified");
    } else {
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };
