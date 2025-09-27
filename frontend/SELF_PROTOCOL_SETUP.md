# Self Protocol Integration for ZKVault

This guide explains how to integrate the official Self Protocol SDK for human verification in ZKVault.

## 🚀 Quick Start

### 1. Install Dependencies

The Self Protocol SDK is already added to your `package.json`:

```bash
bun install
# or
npm install
```

### 2. Deploy ProofOfHuman Contract

First, you need to deploy a ProofOfHuman contract that integrates with Self Protocol:

```solidity
// contracts/ProofOfHuman.sol
pragma solidity ^0.8.19;

import "@selfxyz/contracts/SelfVerificationRoot.sol";

contract ProofOfHuman is SelfVerificationRoot {
    mapping(address => bool) public verifiedHumans;
    bytes32 public verificationConfigId;
    
    event VerificationCompleted(
        ISelfVerificationRoot.GenericDiscloseOutputV2 output,
        bytes userData
    );
    
    constructor(
        address _hubAddress,
        uint256 _scope,
        bytes32 _verificationConfigId
    ) SelfVerificationRoot(_hubAddress, _scope) {
        verificationConfigId = _verificationConfigId;
    }
    
    function customVerificationHook(
        ISelfVerificationRoot.GenericDiscloseOutputV2 memory output,
        bytes memory userData
    ) internal override {
        // Mark user as verified
        address userAddress = address(uint160(output.userIdentifier));
        verifiedHumans[userAddress] = true;
        
        emit VerificationCompleted(output, userData);
    }
}
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
# Your deployed ProofOfHuman contract addresses
VITE_SELF_CONTRACT_CELO_SEPOLIA=0xYourContractAddress
VITE_SELF_CONTRACT_CELO_MAINNET=0xYourContractAddress

# Self Protocol App Configuration
VITE_SELF_APP_NAME="ZKVault Protocol"
VITE_SELF_SCOPE="zkvault-human-verification"
```

### 4. Network Support

Currently supported networks:

- **Celo Sepolia (Testnet)**: For development and testing
  - Hub: `0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74`
  - RPC: `https://forno.celo-sepolia.celo-testnet.org`
  - Supports mock passports for testing

- **Celo Mainnet**: For production
  - Hub: `0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF`
  - RPC: `https://forno.celo.org`
  - Requires real passport verification

## 🛠️ Implementation Details

### Self Protocol Service

The `selfProtocolService.js` uses the official `@selfxyz/core` SDK:

```javascript
import { SelfAppBuilder } from '@selfxyz/qrcode';

const selfApp = new SelfAppBuilder({
    endpoint: contractAddress,
    endpointType: 'staging_celo', // or 'celo' for mainnet
    userIdType: 'hex',
    version: 2,
    appName: 'ZKVault Protocol',
    scope: 'zkvault-human-verification',
    userId: userAddress,
    disclosures: {
        minimumAge: 18,
        nationality: true,
        date_of_birth: true,
        // ... other requirements
    }
}).build();
```

### Verification Flow

1. **Initialize**: SDK connects to your ProofOfHuman contract
2. **Generate URL**: Creates verification URL for Self Protocol app
3. **User Verification**: User completes verification on mobile device
4. **Contract Update**: ProofOfHuman contract is automatically updated
5. **Status Check**: Frontend checks verification status

### Privacy & Security

- **Zero-Knowledge**: Personal data never leaves user's device
- **NFC Passport Reading**: Uses secure passport chip data
- **Decentralized**: No central authority stores user data
- **Compliance**: Supports age verification and nationality checks

## 📱 User Experience

1. User clicks "Start Human Verification"
2. Popup opens to Self Protocol verification page
3. User follows mobile app instructions:
   - Download Self Protocol app
   - Scan passport with NFC
   - Complete biometric verification
4. Verification completes automatically
5. User can now access ZKVault features

## 🔧 Development & Testing

### Testing on Celo Sepolia

1. Use Celo Sepolia testnet for development
2. Mock passports are supported for testing
3. No real passport required during development

### Production Deployment

1. Deploy to Celo Mainnet
2. Real passport verification required
3. Update environment variables
4. Test thoroughly before launch

## 🌍 Supported Countries

Self Protocol supports passports from 150+ countries. Check the latest list at [docs.self.xyz](https://docs.self.xyz).

## 📚 Resources

- **Self Protocol Docs**: [docs.self.xyz](https://docs.self.xyz)
- **Workshop Repository**: [github.com/selfxyz/workshop](https://github.com/selfxyz/workshop)
- **Telegram Support**: [t.me/selfprotocol](https://t.me/selfprotocol)
- **SDK Documentation**: [@selfxyz/core](https://www.npmjs.com/package/@selfxyz/core)

## 🚨 Important Notes

1. **Mobile Required**: Verification requires mobile device with NFC
2. **Passport Required**: Valid passport with NFC chip needed
3. **Age Restriction**: Must be 18+ years old
4. **Network Fees**: Celo has very low transaction fees
5. **Privacy First**: No personal data is stored on-chain

## 🔍 Troubleshooting

### Common Issues

1. **Contract Not Found**: Ensure contract is deployed and address is correct
2. **Network Mismatch**: Check you're on the right network (Celo)
3. **Verification Failed**: Ensure passport has NFC and is supported
4. **Mobile Issues**: Try different mobile device or update Self app

### Getting Help

- Check the console for detailed error messages
- Join the Telegram community for support
- Review the workshop repository for examples
- Check network status and contract deployment

## 🎯 Next Steps

After Self Protocol integration:

1. Test verification flow thoroughly
2. Deploy ProofOfHuman contract to mainnet
3. Update environment configuration
4. Monitor verification success rates
5. Implement additional compliance features as needed

The Self Protocol integration provides enterprise-grade human verification with maximum privacy and security for ZKVault users.
