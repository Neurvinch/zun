import zkProofService from './zkProofService';
import ipfsService from './ipfsService';
import keyManager from './keyManager';
import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';

class ZKVaultClient {
    constructor() {
        this.isInitialized = false;
        this.encryptionKey = null;
        this.receipts = new Map(); // Local receipt cache
    }

    /**
     * Initialize ZKVault client
     * @param {Object} signer - Ethers signer
     * @param {String} userAddress - User's wallet address
     */
    async initialize(signer, userAddress) {
        try {
            // Initialize IPFS connection
            await ipfsService.initialize();
            
            // Generate encryption key from user signature
            const message = `ZKVault Encryption Key for ${userAddress}`;
            const signature = await signer.signMessage(message);
            this.encryptionKey = keyManager.derivePrivateKey(signature, 'encryption');
            
            this.isInitialized = true;
            console.log('ZKVault client initialized successfully');
            
        } catch (error) {
            console.error('ZKVault client initialization failed:', error);
            throw new Error(`Initialization failed: ${error.message}`);
        }
    }

    /**
     * Generate ZK proof and prepare submission data
     * @param {Object} swapParams - Swap parameters
     * @param {Object} userWalletData - User wallet data
     * @returns {Object} - Complete proof package
     */
    async generateProofPackage(swapParams, userWalletData) {
        if (!this.isInitialized) {
            throw new Error('ZKVault client not initialized');
        }

        try {
            const {
                tokenAddress,
                swapAmount,
                balance,
                zkPrivateKey,
                nonce,
                eligibilityFlag,
                chainId
            } = swapParams;

            // Prepare circuit inputs
            const privateInputs = {
                balance: balance.toString(),
                swapAmount: swapAmount.toString(),
                privateKey: zkPrivateKey,
                nonce: nonce,
                eligibilityFlag: eligibilityFlag ? 1 : 0
            };

            const publicInputs = {
                minBalance: userWalletData.minBalance.toString(),
                maxSwapAmount: userWalletData.maxSwapAmount.toString(),
                merkleRoot: userWalletData.merkleRoot || '0x1234567890abcdef'
            };

            console.log('Generating ZK proof...');
            
            // Generate proof using WASM prover
            const proofResult = await zkProofService.generateSwapProof(privateInputs, publicInputs);
            
            // Verify proof locally
            const isValid = await zkProofService.verifyProof(proofResult.proof, proofResult.publicSignals);
            if (!isValid) {
                throw new Error('Generated proof failed local verification');
            }

            // Format proof for contract submission
            const formattedProof = this.formatProofForContract(proofResult);
            
            // Create proof.json structure
            const proofJson = this.createProofJson(proofResult, swapParams);
            
            return {
                proof: formattedProof,
                proofJson: proofJson,
                publicSignals: proofResult.publicSignals,
                nullifier: proofResult.nullifier,
                commitment: proofResult.commitment,
                isEligible: proofResult.isEligible,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Proof generation failed:', error);
            throw new Error(`Proof generation failed: ${error.message}`);
        }
    }

    /**
     * Create encrypted receipt and store on IPFS
     * @param {Object} swapDetails - Swap transaction details
     * @param {Object} proofData - ZK proof data
     * @returns {String} - IPFS CID of encrypted receipt
     */
    async createEncryptedReceipt(swapDetails, proofData) {
        if (!this.isInitialized) {
            throw new Error('ZKVault client not initialized');
        }

        try {
            // Create structured receipt data
            const receiptData = ipfsService.createReceiptData(swapDetails, proofData);
            
            // Store encrypted receipt on IPFS
            const cid = await ipfsService.storeEncryptedReceipt(receiptData, this.encryptionKey);
            
            // Cache receipt locally
            this.receipts.set(cid, {
                receiptData,
                timestamp: Date.now(),
                swapAmount: swapDetails.amountIn,
                tokenSymbol: swapDetails.tokenIn.symbol
            });
            
            console.log('Encrypted receipt created and stored:', cid);
            return cid;
            
        } catch (error) {
            console.error('Receipt creation failed:', error);
            throw new Error(`Receipt creation failed: ${error.message}`);
        }
    }

    /**
     * Submit verification data to contracts
     * @param {Object} proofPackage - Complete proof package
     * @param {Object} contractAddresses - Contract addresses
     * @param {Object} signer - Ethers signer
     * @returns {Object} - Submission result
     */
    async submitVerificationData(proofPackage, contractAddresses, signer) {
        try {
            const { zkVaultContract } = contractAddresses;

            // Prepare contract call data
            const callData = this.encodeContractCallData(proofPackage);
            
            // Submit to ZKVault contract
            const zkVaultTx = await this.submitToZKVault(
                zkVaultContract,
                proofPackage,
                callData,
                signer
            );
            
            
            return {
                zkVaultTxHash: zkVaultTx.hash,
                timestamp: Date.now(),
                status: 'submitted'
            };
            
        } catch (error) {
            console.error('Verification data submission failed:', error);
            throw new Error(`Submission failed: ${error.message}`);
        }
    }

    /**
     * Complete Step 2 workflow: Generate proof, create receipt, submit data
     * @param {Object} swapParams - Swap parameters
     * @param {Object} userWalletData - User wallet data
     * @param {Object} contractAddresses - Contract addresses
     * @param {Object} signer - Ethers signer
     * @returns {Object} - Complete workflow result
     */
    async executeStep2Workflow(swapParams, userWalletData, contractAddresses, signer) {
        if (!this.isInitialized) {
            throw new Error('ZKVault client not initialized');
        }

        try {
            console.log('Starting ZKVault Step 2 workflow...');
            
            // 1. Generate ZK proof package
            const proofPackage = await this.generateProofPackage(swapParams, userWalletData);
            console.log('✓ ZK proof generated');
            
            // 2. Create encrypted receipt (prepare for post-swap storage)
            const receiptTemplate = {
                tokenIn: swapParams.tokenIn,
                tokenOut: swapParams.tokenOut,
                amountIn: swapParams.swapAmount,
                userAddress: swapParams.userAddress,
                chainId: swapParams.chainId,
                timestamp: Date.now(),
                // Transaction details will be filled after swap execution
                txHash: null,
                blockNumber: null,
                amountOut: null,
                gasUsed: null,
                gasPrice: null
            };
            
            // 3. Submit verification data to contracts
            const submissionResult = await this.submitVerificationData(
                proofPackage,
                contractAddresses,
                signer
            );
            console.log('✓ Verification data submitted');
            
            return {
                proofPackage,
                receiptTemplate,
                submissionResult,
                encryptionKey: this.encryptionKey,
                workflow: 'step2_complete',
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Step 2 workflow failed:', error);
            throw new Error(`Workflow failed: ${error.message}`);
        }
    }

    /**
     * Retrieve and decrypt receipt from IPFS
     * @param {String} cid - IPFS CID
     * @returns {Object} - Decrypted receipt data
     */
    async retrieveReceipt(cid) {
        if (!this.isInitialized) {
            throw new Error('ZKVault client not initialized');
        }

        try {
            // Check local cache first
            if (this.receipts.has(cid)) {
                return this.receipts.get(cid).receiptData;
            }
            
            // Retrieve from IPFS
            const receiptData = await ipfsService.retrieveEncryptedReceipt(cid, this.encryptionKey);
            
            // Cache locally
            this.receipts.set(cid, {
                receiptData,
                timestamp: Date.now()
            });
            
            return receiptData;
            
        } catch (error) {
            console.error('Receipt retrieval failed:', error);
            throw new Error(`Receipt retrieval failed: ${error.message}`);
        }
    }

    /**
     * Format proof for Solidity contract
     * @param {Object} proofResult - Raw proof result
     * @returns {Object} - Formatted proof
     */
    formatProofForContract(proofResult) {
        return {
            a: [proofResult.proof.a[0], proofResult.proof.a[1]],
            b: [
                [proofResult.proof.b[0][1], proofResult.proof.b[0][0]],
                [proofResult.proof.b[1][1], proofResult.proof.b[1][0]]
            ],
            c: [proofResult.proof.c[0], proofResult.proof.c[1]],
            publicSignals: proofResult.publicSignals
        };
    }

    /**
     * Create proof.json structure
     * @param {Object} proofResult - Proof result
     * @param {Object} swapParams - Swap parameters
     * @returns {Object} - Structured proof.json
     */
    createProofJson(proofResult, swapParams) {
        return {
            protocol: 'groth16',
            curve: 'bn128',
            proof: {
                pi_a: proofResult.proof.a,
                pi_b: proofResult.proof.b,
                pi_c: proofResult.proof.c
            },
            publicSignals: proofResult.publicSignals,
            metadata: {
                circuit: 'swapEligibility',
                version: '1.0',
                timestamp: Date.now(),
                nullifier: proofResult.nullifier,
                commitment: proofResult.commitment,
                chainId: swapParams.chainId,
                userAddress: swapParams.userAddress
            }
        };
    }

    /**
     * Encode contract call data
     * @param {Object} proofPackage - Proof package
     * @returns {String} - Encoded call data
     */
    encodeContractCallData(proofPackage) {
        // This would encode the proof and public signals for contract calls
        // Implementation depends on specific contract ABI
        return ethers.AbiCoder.defaultAbiCoder().encode(
            ['uint256[2]', 'uint256[2][2]', 'uint256[2]', 'uint256[]'],
            [
                proofPackage.proof.a,
                proofPackage.proof.b,
                proofPackage.proof.c,
                proofPackage.publicSignals
            ]
        );
    }

    /**
     * Submit to ZKVault contract
     * @param {String} contractAddress - Contract address
     * @param {Object} proofPackage - Proof package
     * @param {String} callData - Encoded call data
     * @param {Object} signer - Ethers signer
     * @returns {Object} - Transaction result
     */
    async submitToZKVault(contractAddress, proofPackage, callData, signer) {
        // Mock implementation - replace with actual contract interaction
        console.log('Submitting to ZKVault contract:', contractAddress);
        
        return {
            hash: '0x' + Math.random().toString(16).substr(2, 64),
            timestamp: Date.now(),
            status: 'pending'
        };
    }


    /**
     * Get client status and statistics
     * @returns {Object} - Client status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            ipfsConnected: ipfsService.isConnected(),
            receiptsCount: this.receipts.size,
            encryptionKeySet: !!this.encryptionKey
        };
    }
}

export default new ZKVaultClient();
