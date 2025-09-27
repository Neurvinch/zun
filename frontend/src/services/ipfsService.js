import { create } from 'kubo-rpc-client';
import CryptoJS from 'crypto-js';
import { fromString, toString } from 'uint8arrays';

class IPFSService {
    constructor() {
        // Default to local IPFS node, fallback to public gateways
        this.ipfsNodes = [
            'http://127.0.0.1:5001', // Local IPFS node
            'https://ipfs.infura.io:5001', // Infura IPFS
            'https://api.web3.storage' // Web3.Storage
        ];
        this.client = null;
        this.currentNodeIndex = 0;
    }

    /**
     * Initialize IPFS client with fallback nodes
     */
    async initialize() {
        for (let i = 0; i < this.ipfsNodes.length; i++) {
            try {
                const nodeUrl = this.ipfsNodes[this.currentNodeIndex];
                console.log(`Attempting to connect to IPFS node: ${nodeUrl}`);
                
                this.client = create({ url: nodeUrl });
                
                // Test connection
                await this.client.id();
                console.log(`Successfully connected to IPFS node: ${nodeUrl}`);
                return true;
                
            } catch (error) {
                console.warn(`Failed to connect to IPFS node ${this.ipfsNodes[this.currentNodeIndex]}:`, error);
                this.currentNodeIndex = (this.currentNodeIndex + 1) % this.ipfsNodes.length;
            }
        }
        
        throw new Error('Failed to connect to any IPFS node');
    }

    /**
     * Encrypt swap receipt data using AES-GCM
     * @param {Object} receiptData - Swap receipt data
     * @param {String} encryptionKey - AES encryption key
     * @returns {Object} - Encrypted data with metadata
     */
    encryptReceipt(receiptData, encryptionKey) {
        try {
            const jsonString = JSON.stringify(receiptData);
            
            // Generate random IV for AES-GCM
            const iv = CryptoJS.lib.WordArray.random(96/8); // 96-bit IV for GCM
            
            // Encrypt using AES-GCM
            const encrypted = CryptoJS.AES.encrypt(jsonString, encryptionKey, {
                iv: iv,
                mode: CryptoJS.mode.GCM,
                padding: CryptoJS.pad.NoPadding
            });

            return {
                encryptedData: encrypted.toString(),
                iv: iv.toString(CryptoJS.enc.Hex),
                algorithm: 'AES-GCM',
                timestamp: Date.now(),
                version: '1.0'
            };
            
        } catch (error) {
            console.error('Receipt encryption failed:', error);
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt swap receipt data
     * @param {Object} encryptedReceipt - Encrypted receipt object
     * @param {String} decryptionKey - AES decryption key
     * @returns {Object} - Decrypted receipt data
     */
    decryptReceipt(encryptedReceipt, decryptionKey) {
        try {
            const { encryptedData, iv, algorithm } = encryptedReceipt;
            
            if (algorithm !== 'AES-GCM') {
                throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
            }

            // Decrypt using AES-GCM
            const decrypted = CryptoJS.AES.decrypt(encryptedData, decryptionKey, {
                iv: CryptoJS.enc.Hex.parse(iv),
                mode: CryptoJS.mode.GCM,
                padding: CryptoJS.pad.NoPadding
            });

            const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
            return JSON.parse(jsonString);
            
        } catch (error) {
            console.error('Receipt decryption failed:', error);
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Store encrypted receipt on IPFS
     * @param {Object} receiptData - Swap receipt data
     * @param {String} encryptionKey - AES encryption key
     * @returns {String} - IPFS CID
     */
    async storeEncryptedReceipt(receiptData, encryptionKey) {
        if (!this.client) {
            await this.initialize();
        }

        try {
            // Encrypt the receipt
            const encryptedReceipt = this.encryptReceipt(receiptData, encryptionKey);
            
            // Convert to Uint8Array for IPFS
            const data = fromString(JSON.stringify(encryptedReceipt));
            
            // Add to IPFS
            const result = await this.client.add(data, {
                pin: true, // Pin the content
                cidVersion: 1 // Use CIDv1
            });

            console.log('Encrypted receipt stored on IPFS:', result.cid.toString());
            return result.cid.toString();
            
        } catch (error) {
            console.error('Failed to store encrypted receipt:', error);
            throw new Error(`IPFS storage failed: ${error.message}`);
        }
    }

    /**
     * Retrieve and decrypt receipt from IPFS
     * @param {String} cid - IPFS CID
     * @param {String} decryptionKey - AES decryption key
     * @returns {Object} - Decrypted receipt data
     */
    async retrieveEncryptedReceipt(cid, decryptionKey) {
        if (!this.client) {
            await this.initialize();
        }

        try {
            // Retrieve from IPFS
            const chunks = [];
            for await (const chunk of this.client.cat(cid)) {
                chunks.push(chunk);
            }
            
            // Combine chunks and parse
            const data = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let offset = 0;
            for (const chunk of chunks) {
                data.set(chunk, offset);
                offset += chunk.length;
            }
            
            const jsonString = toString(data);
            const encryptedReceipt = JSON.parse(jsonString);
            
            // Decrypt and return
            return this.decryptReceipt(encryptedReceipt, decryptionKey);
            
        } catch (error) {
            console.error('Failed to retrieve encrypted receipt:', error);
            throw new Error(`IPFS retrieval failed: ${error.message}`);
        }
    }

    /**
     * Create swap receipt data structure
     * @param {Object} swapDetails - Swap transaction details
     * @param {Object} proofData - ZK proof data
     * @returns {Object} - Structured receipt data
     */
    createReceiptData(swapDetails, proofData) {
        return {
            // Transaction details
            txHash: swapDetails.txHash,
            blockNumber: swapDetails.blockNumber,
            timestamp: swapDetails.timestamp,
            
            // Swap information
            tokenIn: swapDetails.tokenIn,
            tokenOut: swapDetails.tokenOut,
            amountIn: swapDetails.amountIn,
            amountOut: swapDetails.amountOut,
            userAddress: swapDetails.userAddress,
            
            // ZK proof data
            nullifier: proofData.nullifier,
            commitment: proofData.commitment,
            merkleRoot: proofData.publicSignals?.[2] || '0x0',
            
            // Privacy metadata
            isPrivate: true,
            protocol: 'ZKVault',
            version: '1.0',
            
            // Verification
            proofVerified: proofData.isEligible,
            eligibilityChecked: true,
            
            // Additional metadata
            chainId: swapDetails.chainId,
            gasUsed: swapDetails.gasUsed,
            gasPrice: swapDetails.gasPrice,
            
            // Receipt metadata
            receiptId: this.generateReceiptId(),
            createdAt: Date.now()
        };
    }

    /**
     * Generate unique receipt ID
     * @returns {String} - Unique receipt identifier
     */
    generateReceiptId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `zkvault_${timestamp}_${random}`;
    }

    /**
     * Pin content to ensure persistence
     * @param {String} cid - IPFS CID to pin
     * @returns {Boolean} - Success status
     */
    async pinContent(cid) {
        if (!this.client) {
            await this.initialize();
        }

        try {
            await this.client.pin.add(cid);
            console.log(`Content pinned: ${cid}`);
            return true;
        } catch (error) {
            console.error('Failed to pin content:', error);
            return false;
        }
    }

    /**
     * Get IPFS node info
     * @returns {Object} - Node information
     */
    async getNodeInfo() {
        if (!this.client) {
            await this.initialize();
        }

        try {
            const info = await this.client.id();
            return {
                id: info.id,
                publicKey: info.publicKey,
                addresses: info.addresses,
                agentVersion: info.agentVersion,
                protocolVersion: info.protocolVersion
            };
        } catch (error) {
            console.error('Failed to get node info:', error);
            return null;
        }
    }

    /**
     * Check if IPFS client is connected
     * @returns {Boolean} - Connection status
     */
    isConnected() {
        return this.client !== null;
    }

    /**
     * Batch store multiple receipts
     * @param {Array} receipts - Array of receipt data objects
     * @param {String} encryptionKey - AES encryption key
     * @returns {Array} - Array of CIDs
     */
    async batchStoreReceipts(receipts, encryptionKey) {
        const results = [];
        
        for (const receipt of receipts) {
            try {
                const cid = await this.storeEncryptedReceipt(receipt, encryptionKey);
                results.push({ success: true, cid, receiptId: receipt.receiptId });
            } catch (error) {
                results.push({ success: false, error: error.message, receiptId: receipt.receiptId });
            }
        }
        
        return results;
    }
}

export default new IPFSService();
