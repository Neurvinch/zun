const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Deploying ZKVault Custom Identity System...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const deploymentResults = {
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {}
    };

    try {
        // 1. Deploy Custom Identity Verification Contract
        console.log("\n📋 1. Deploying CustomIdentityVerification...");
        const CustomIdentityVerification = await ethers.getContractFactory("CustomIdentityVerification");
        const identityVerifier = await CustomIdentityVerification.deploy();
        await identityVerifier.deployed();
        
        console.log("✅ CustomIdentityVerification deployed to:", identityVerifier.address);
        deploymentResults.contracts.CustomIdentityVerification = {
            address: identityVerifier.address,
            txHash: identityVerifier.deployTransaction.hash
        };

        // 2. Deploy ZKVault Custom Contract
        console.log("\n🔐 2. Deploying ZKVaultCustom...");
        const ZKVaultCustom = await ethers.getContractFactory("ZKVaultCustom");
        const zkVault = await ZKVaultCustom.deploy(identityVerifier.address);
        await zkVault.deployed();
        
        console.log("✅ ZKVaultCustom deployed to:", zkVault.address);
        deploymentResults.contracts.ZKVaultCustom = {
            address: zkVault.address,
            txHash: zkVault.deployTransaction.hash,
            constructor: {
                identityVerifier: identityVerifier.address
            }
        };

        // 3. Deploy DataCoin (ERC-20 governance token)
        console.log("\n🪙 3. Deploying DataCoin...");
        const DataCoin = await ethers.getContractFactory("DataCoin");
        const dataCoin = await DataCoin.deploy();
        await dataCoin.deployed();
        
        console.log("✅ DataCoin deployed to:", dataCoin.address);
        deploymentResults.contracts.DataCoin = {
            address: dataCoin.address,
            txHash: dataCoin.deployTransaction.hash
        };

        // 4. Deploy DataDAO
        console.log("\n🏛️ 4. Deploying DataDAO...");
        const DataDAO = await ethers.getContractFactory("DataDAO");
        const dataDAO = await DataDAO.deploy(dataCoin.address);
        await dataDAO.deployed();
        
        console.log("✅ DataDAO deployed to:", dataDAO.address);
        deploymentResults.contracts.DataDAO = {
            address: dataDAO.address,
            txHash: dataDAO.deployTransaction.hash,
            constructor: {
                dataCoin: dataCoin.address
            }
        };

        // 5. Deploy Updated AirdropGating
        console.log("\n🎯 5. Deploying AirdropGating (Custom)...");
        const AirdropGating = await ethers.getContractFactory("AirdropGating");
        const airdropGating = await AirdropGating.deploy(identityVerifier.address);
        await airdropGating.deployed();
        
        console.log("✅ AirdropGating deployed to:", airdropGating.address);
        deploymentResults.contracts.AirdropGating = {
            address: airdropGating.address,
            txHash: airdropGating.deployTransaction.hash,
            constructor: {
                identityVerifier: identityVerifier.address
            }
        };

        // 6. Deploy GasPoolDAO
        console.log("\n⛽ 6. Deploying GasPoolDAO...");
        const GasPoolDAO = await ethers.getContractFactory("GasPoolDAO");
        const gasPoolDAO = await GasPoolDAO.deploy(dataCoin.address);
        await gasPoolDAO.deployed();
        
        console.log("✅ GasPoolDAO deployed to:", gasPoolDAO.address);
        deploymentResults.contracts.GasPoolDAO = {
            address: gasPoolDAO.address,
            txHash: gasPoolDAO.deployTransaction.hash,
            constructor: {
                dataCoin: dataCoin.address
            }
        };

        // 7. Deploy PrivacyAuditSystem
        console.log("\n🔍 7. Deploying PrivacyAuditSystem...");
        const PrivacyAuditSystem = await ethers.getContractFactory("PrivacyAuditSystem");
        const privacyAudit = await PrivacyAuditSystem.deploy();
        await privacyAudit.deployed();
        
        console.log("✅ PrivacyAuditSystem deployed to:", privacyAudit.address);
        deploymentResults.contracts.PrivacyAuditSystem = {
            address: privacyAudit.address,
            txHash: privacyAudit.deployTransaction.hash
        };

        // 8. Setup Initial Configuration
        console.log("\n⚙️ 8. Setting up initial configuration...");

        // Add some trusted verifiers to the identity system
        console.log("Adding trusted verifiers...");
        await identityVerifier.addTrustedVerifier(deployer.address, "deployer");
        
        // Add some supported tokens to ZKVault (using common testnet tokens)
        console.log("Adding supported tokens...");
        const commonTokens = {
            // Ethereum Sepolia
            "USDC": "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", // Mock USDC
            "USDT": "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", // Mock USDT
            "DAI": "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357",  // Mock DAI
        };

        for (const [symbol, address] of Object.entries(commonTokens)) {
            try {
                await zkVault.addSupportedToken(address);
                console.log(`✅ Added ${symbol} token: ${address}`);
            } catch (error) {
                console.log(`⚠️ Could not add ${symbol} token (may not exist on this network)`);
            }
        }

        // Setup initial swap configuration
        console.log("Configuring swap parameters...");
        await zkVault.updateSwapConfig(
            100,  // minVerificationScore
            ethers.utils.parseEther("10"), // maxSwapAmount (10 ETH)
            ethers.utils.parseEther("50"), // dailySwapLimit (50 ETH)
            30    // swapFee (0.3%)
        );

        // Create a sample airdrop campaign
        console.log("Creating sample airdrop campaign...");
        const eligibilityCriteria = {
            requiresHumanVerification: true,
            requiresAgeVerification: false,
            minimumAge: 0,
            requiresCountryVerification: false,
            allowedCountries: [],
            requiresKYC: false,
            requiresUniqueIdentity: true,
            minimumTradingVolume: 0,
            minimumStakeAmount: 0,
            requiresDataContribution: false
        };

        const startTime = Math.floor(Date.now() / 1000);
        const endTime = startTime + (30 * 24 * 60 * 60); // 30 days from now

        await airdropGating.createCampaign(
            "ZKVault Genesis Airdrop",
            "Welcome airdrop for verified users of ZKVault Protocol",
            0, // TOKEN type
            dataCoin.address,
            0, // tokenId (not used for ERC20)
            ethers.utils.parseEther("100"), // 100 DataCoin per claim
            ethers.utils.parseEther("10000"), // 10,000 total supply
            startTime,
            endTime,
            eligibilityCriteria,
            ethers.constants.HashZero // no merkle root
        );

        console.log("✅ Sample airdrop campaign created");

        // 9. Save deployment results
        console.log("\n💾 9. Saving deployment results...");
        const deploymentsDir = path.join(__dirname, "..", "deployments");
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        const deploymentFile = path.join(deploymentsDir, `${hre.network.name}-custom.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentResults, null, 2));

        // Create environment variables file
        const envContent = `
# ZKVault Custom Identity System - ${hre.network.name.toUpperCase()}
# Generated on ${new Date().toISOString()}

# Contract Addresses
VITE_CUSTOM_IDENTITY_VERIFIER_ADDRESS="${identityVerifier.address}"
VITE_ZKVAULT_CUSTOM_ADDRESS="${zkVault.address}"
VITE_DATA_COIN_ADDRESS="${dataCoin.address}"
VITE_DATA_DAO_ADDRESS="${dataDAO.address}"
VITE_AIRDROP_GATING_ADDRESS="${airdropGating.address}"
VITE_GAS_POOL_DAO_ADDRESS="${gasPoolDAO.address}"
VITE_PRIVACY_AUDIT_SYSTEM_ADDRESS="${privacyAudit.address}"

# Network Configuration
VITE_NETWORK_NAME="${hre.network.name}"
VITE_CHAIN_ID="${hre.network.config.chainId || 'unknown'}"
`;

        const envFile = path.join(__dirname, "..", "frontend", `.env.${hre.network.name}`);
        fs.writeFileSync(envFile, envContent);

        // 10. Display summary
        console.log("\n🎉 DEPLOYMENT COMPLETE!");
        console.log("=====================================");
        console.log(`Network: ${hre.network.name}`);
        console.log(`Deployer: ${deployer.address}`);
        console.log(`Timestamp: ${deploymentResults.timestamp}`);
        console.log("\n📋 Contract Addresses:");
        console.log("=====================================");
        
        Object.entries(deploymentResults.contracts).forEach(([name, info]) => {
            console.log(`${name}: ${info.address}`);
        });

        console.log("\n🔗 Key Integration Points:");
        console.log("=====================================");
        console.log(`• Identity Verifier: ${identityVerifier.address}`);
        console.log(`• ZKVault Custom: ${zkVault.address}`);
        console.log(`• DataCoin Token: ${dataCoin.address}`);
        console.log(`• Airdrop Gating: ${airdropGating.address}`);

        console.log("\n📁 Files Created:");
        console.log("=====================================");
        console.log(`• Deployment data: ${deploymentFile}`);
        console.log(`• Environment vars: ${envFile}`);

        console.log("\n🚀 Next Steps:");
        console.log("=====================================");
        console.log("1. Update frontend to use new contract addresses");
        console.log("2. Test identity verification flow");
        console.log("3. Test shielded swaps with custom verification");
        console.log("4. Configure additional trusted verifiers");
        console.log("5. Add more supported tokens as needed");

        console.log("\n✨ Custom Identity Verification Features:");
        console.log("=====================================");
        console.log("• Social Verification (community vouching)");
        console.log("• Activity-based Verification (on-chain behavior)");
        console.log("• Stake-based Verification (economic incentives)");
        console.log("• Biometric ZK Proofs (privacy-preserving)");
        console.log("• Multi-signature Verification (trusted verifiers)");
        console.log("• Time-lock Verification (commitment-based)");
        console.log("• Cross-chain Verification (multi-network identity)");

        return deploymentResults;

    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        
        // Save partial deployment results if any contracts were deployed
        if (Object.keys(deploymentResults.contracts).length > 0) {
            const deploymentsDir = path.join(__dirname, "..", "deployments");
            if (!fs.existsSync(deploymentsDir)) {
                fs.mkdirSync(deploymentsDir, { recursive: true });
            }
            
            const failedDeploymentFile = path.join(deploymentsDir, `${hre.network.name}-custom-failed.json`);
            deploymentResults.error = error.message;
            fs.writeFileSync(failedDeploymentFile, JSON.stringify(deploymentResults, null, 2));
            console.log(`Partial deployment data saved to: ${failedDeploymentFile}`);
        }
        
        throw error;
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

module.exports = main;
