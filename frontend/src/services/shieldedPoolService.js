import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { poseidon } from 'poseidon-lite';

// Shielded Pool Contract ABI
const SHIELDED_POOL_ABI = [
    {
        "inputs": [
            {"name": "proof", "type": "uint256[8]"},
            {"name": "root", "type": "uint256"},
            {"name": "nullifierHash", "type": "uint256"},
            {"name": "commitmentHash", "type": "uint256"},
            {"name": "recipient", "type": "address"},
            {"name": "relayer", "type": "address"},
            {"name": "fee", "type": "uint256"},
            {"name": "refund", "type": "uint256"}
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "commitment", "type": "uint256"}
        ],
        "name": "deposit",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "proof", "type": "uint256[8]"},
            {"name": "swapData", "type": "bytes"},
            {"name": "nullifierHash", "type": "uint256"},
            {"name": "newCommitment", "type": "uint256"},
            {"name": "recipient", "type": "address"}
        ],
        "name": "privateSwap",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getLatestRoot",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "nullifierHash", "type": "uint256"}],
        "name": "isSpent",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "commitment", "type": "uint256"}],
        "name": "commitments",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextIndex",
        "outputs": [{"name": "", "type": "uint32"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "name": "commitment", "type": "uint256"},
            {"indexed": false, "name": "leafIndex", "type": "uint32"},
            {"indexed": false, "name": "timestamp", "type": "uint256"}
        ],
        "name": "Deposit",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": false, "name": "to", "type": "address"},
            {"indexed": false, "name": "nullifierHash", "type": "uint256"},
            {"indexed": true, "name": "relayer", "type": "address"},
            {"indexed": false, "name": "fee", "type": "uint256"}
        ],
        "name": "Withdrawal",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": false, "name": "nullifierHash", "type": "uint256"},
            {"indexed": false, "name": "newCommitment", "type": "uint256"},
            {"indexed": false, "name": "recipient", "type": "address"}
        ],
        "name": "PrivateSwap",
        "type": "event"
    }
];
class ShieldedPoolService {
    constructor() {
        this.contracts = new Map(); // Chain ID -> Contract instance
        this.merkleTree = null;
        this.commitments = [];
        this.nullifiers = new Set();
        this.poseidonHash = null;
        this.isInitialized = false;
        
        // Contract addresses for different chains (from Vite env)
        this.contractAddresses = {
            1: import.meta.env.VITE_SHIELDED_POOL_ETHEREUM_MAINNET || '0x0000000000000000000000000000000000000000',
            11155111: import.meta.env.VITE_SHIELDED_POOL_ETHEREUM_SEPOLIA || '0x0000000000000000000000000000000000000000',
            42220: import.meta.env.VITE_SHIELDED_POOL_CELO_MAINNET || '0x0000000000000000000000000000000000000000',
            44787: import.meta.env.VITE_SHIELDED_POOL_CELO_SEPOLIA || '0x0000000000000000000000000000000000000000',
            137: import.meta.env.VITE_SHIELDED_POOL_POLYGON || '0x0000000000000000000000000000000000000000',
            42161: import.meta.env.VITE_SHIELDED_POOL_ARBITRUM || '0x0000000000000000000000000000000000000000'
        };
    }

    /**
     * Initialize Shielded Pool service
     * @param {Object} provider - Ethers provider
     * @param {Number} chainId - Chain ID
     */
    async initialize(provider, chainId) {
        try {
            const contractAddress = this.contractAddresses[chainId];
            
            if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
                console.warn('Shielded Pool contract not deployed on this chain');
                return false;
            }

            // Initialize contract
            const contract = new ethers.Contract(contractAddress, SHIELDED_POOL_ABI, provider);
            this.contracts.set(chainId, contract);

            // Initialize Poseidon hash function using poseidon-lite
            this.poseidonHash = poseidon;

            // Load existing commitments and build Merkle tree
            await this.loadCommitments(chainId);
            await this.buildMerkleTree();

            this.isInitialized = true;
            console.log(`Shielded Pool service initialized on chain ${chainId}`);
            return true;
            
        } catch (error) {
            console.error('Shielded Pool initialization failed:', error);
            return false;
        }
    }

    /**
     * Load existing commitments from the contract
     * @param {Number} chainId - Chain ID
     */
    async loadCommitments(chainId) {
        try {
            const contract = this.contracts.get(chainId);
            if (!contract) return;

            // Get deposit events to load all commitments
            const filter = contract.filters.Deposit();
            const events = await contract.queryFilter(filter, 0, 'latest');
            
            this.commitments = events.map(event => ({
                commitment: event.args.commitment.toString(),
                leafIndex: Number(event.args.leafIndex),
                timestamp: Number(event.args.timestamp),
                blockNumber: event.blockNumber
            })).sort((a, b) => a.leafIndex - b.leafIndex);

            console.log(`Loaded ${this.commitments.length} commitments`);
            
        } catch (error) {
            console.error('Failed to load commitments:', error);
            this.commitments = [];
        }
    }

    /**
     * Build Merkle tree from commitments
     */
    async buildMerkleTree() {
        try {
            if (!this.poseidonHash) {
                console.warn('Poseidon hash not initialized');
                return;
            }

            // Prepare leaves for Merkle tree
            const leaves = this.commitments.map(c => c.commitment);
            
            // Pad to next power of 2 if needed
            const treeDepth = 20; // Support up to 2^20 = ~1M deposits
            const maxLeaves = 2 ** treeDepth;
            
            while (leaves.length < maxLeaves) {
                leaves.push('0');
            }

            // Create Merkle tree with Poseidon hash
            this.merkleTree = new MerkleTree(leaves, (data) => {
                return this.poseidonHash([data]).toString();
            }, { 
                sortPairs: false,
                hashLeaves: false 
            });

            console.log(`Merkle tree built with ${leaves.length} leaves`);
            
        } catch (error) {
            console.error('Merkle tree construction failed:', error);
        }
    }

    /**
     * Generate commitment for deposit
     * @param {String} secret - User's secret
     * @param {String} nullifier - User's nullifier
     * @param {String} amount - Deposit amount
     * @param {String} tokenAddress - Token contract address
     * @returns {Object} - Commitment data
     */
    generateCommitment(secret, nullifier, amount, tokenAddress = ethers.ZeroAddress) {
        try {
            if (!this.poseidonHash) {
                throw new Error('Poseidon hash not initialized');
            }

            // Convert inputs to proper format
            const secretBN = BigInt(secret);
            const nullifierBN = BigInt(nullifier);
            const amountBN = BigInt(amount);
            const tokenBN = BigInt(tokenAddress);

            // Generate commitment: poseidon(secret, nullifier, amount, token)
            const commitment = this.poseidonHash([secretBN, nullifierBN, amountBN, tokenBN]);

            return {
                commitment: commitment.toString(),
                secret: secretBN.toString(),
                nullifier: nullifierBN.toString(),
                amount: amountBN.toString(),
                tokenAddress: tokenAddress,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Commitment generation failed:', error);
            throw new Error(`Commitment generation failed: ${error.message}`);
        }
    }

    /**
     * Generate nullifier hash
     * @param {String} nullifier - User's nullifier
     * @param {Number} leafIndex - Merkle tree leaf index
     * @returns {String} - Nullifier hash
     */
    generateNullifierHash(nullifier, leafIndex) {
        try {
            if (!this.poseidonHash) {
                throw new Error('Poseidon hash not initialized');
            }

            const nullifierBN = BigInt(nullifier);
            const leafIndexBN = BigInt(leafIndex);

            // Generate nullifier hash: poseidon(nullifier, leafIndex)
            const nullifierHash = this.poseidonHash([nullifierBN, leafIndexBN]);

            return nullifierHash.toString();
            
        } catch (error) {
            console.error('Nullifier hash generation failed:', error);
            throw new Error(`Nullifier hash generation failed: ${error.message}`);
        }
    }

    /**
     * Generate Merkle proof for a commitment
     * @param {String} commitment - Commitment to prove
     * @returns {Object} - Merkle proof data
     */
    generateMerkleProof(commitment) {
        try {
            if (!this.merkleTree) {
                throw new Error('Merkle tree not initialized');
            }

            // Find commitment index
            const commitmentIndex = this.commitments.findIndex(c => c.commitment === commitment);
            if (commitmentIndex === -1) {
                throw new Error('Commitment not found in tree');
            }

            // Generate proof
            const proof = this.merkleTree.getProof(commitment, commitmentIndex);
            const root = this.merkleTree.getRoot().toString('hex');

            return {
                proof: proof.map(p => '0x' + p.data.toString('hex')),
                pathIndices: proof.map(p => p.position === 'right' ? 1 : 0),
                root: '0x' + root,
                leafIndex: commitmentIndex
            };
            
        } catch (error) {
            console.error('Merkle proof generation failed:', error);
            throw new Error(`Merkle proof generation failed: ${error.message}`);
        }
    }

    /**
     * Deposit tokens into shielded pool
     * @param {Object} commitmentData - Commitment data
     * @param {Object} signer - Ethers signer
     * @param {Number} chainId - Chain ID
     * @returns {Object} - Transaction result
     */
    async deposit(commitmentData, signer, chainId) {
        try {
            const contract = this.contracts.get(chainId);
            if (!contract) {
                throw new Error('Shielded Pool contract not available');
            }

            const contractWithSigner = contract.connect(signer);
            
            // Execute deposit transaction
            const tx = await contractWithSigner.deposit(
                commitmentData.commitment,
                {
                    value: commitmentData.amount, // For ETH deposits
                    gasLimit: 500000
                }
            );

            console.log('Deposit transaction submitted:', tx.hash);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            // Parse deposit event
            const depositEvent = receipt.logs.find(log => {
                try {
                    const parsed = contract.interface.parseLog(log);
                    return parsed.name === 'Deposit';
                } catch {
                    return false;
                }
            });

            let leafIndex = null;
            if (depositEvent) {
                const parsed = contract.interface.parseLog(depositEvent);
                leafIndex = Number(parsed.args.leafIndex);
            }

            // Update local state
            if (leafIndex !== null) {
                this.commitments.push({
                    commitment: commitmentData.commitment,
                    leafIndex: leafIndex,
                    timestamp: Date.now(),
                    blockNumber: receipt.blockNumber
                });
                
                // Rebuild Merkle tree
                await this.buildMerkleTree();
            }

            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                leafIndex: leafIndex,
                commitment: commitmentData.commitment,
                gasUsed: receipt.gasUsed.toString()
            };
            
        } catch (error) {
            console.error('Deposit failed:', error);
            throw new Error(`Deposit failed: ${error.message}`);
        }
    }

    /**
     * Execute private swap in shielded pool
     * @param {Object} swapData - Swap parameters
     * @param {Object} zkProof - ZK proof for the swap
     * @param {Object} signer - Ethers signer
     * @param {Number} chainId - Chain ID
     * @returns {Object} - Transaction result
     */
    async privateSwap(swapData, zkProof, signer, chainId) {
        try {
            const contract = this.contracts.get(chainId);
            if (!contract) {
                throw new Error('Shielded Pool contract not available');
            }

            const contractWithSigner = contract.connect(signer);
            
            // Prepare swap transaction data
            const swapBytes = this.encodeSwapData(swapData);
            
            // Execute private swap
            const tx = await contractWithSigner.privateSwap(
                zkProof.proof,
                swapBytes,
                swapData.nullifierHash,
                swapData.newCommitment,
                swapData.recipient,
                {
                    gasLimit: 800000
                }
            );

            console.log('Private swap transaction submitted:', tx.hash);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            // Mark nullifier as spent
            this.nullifiers.add(swapData.nullifierHash);
            
            // Add new commitment if provided
            if (swapData.newCommitment && swapData.newCommitment !== '0') {
                const nextIndex = this.commitments.length;
                this.commitments.push({
                    commitment: swapData.newCommitment,
                    leafIndex: nextIndex,
                    timestamp: Date.now(),
                    blockNumber: receipt.blockNumber
                });
                
                // Rebuild Merkle tree
                await this.buildMerkleTree();
            }

            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                nullifierHash: swapData.nullifierHash,
                newCommitment: swapData.newCommitment,
                gasUsed: receipt.gasUsed.toString()
            };
            
        } catch (error) {
            console.error('Private swap failed:', error);
            throw new Error(`Private swap failed: ${error.message}`);
        }
    }

    /**
     * Withdraw from shielded pool
     * @param {Object} withdrawData - Withdrawal parameters
     * @param {Object} zkProof - ZK proof for withdrawal
     * @param {Object} signer - Ethers signer
     * @param {Number} chainId - Chain ID
     * @returns {Object} - Transaction result
     */
    async withdraw(withdrawData, zkProof, signer, chainId) {
        try {
            const contract = this.contracts.get(chainId);
            if (!contract) {
                throw new Error('Shielded Pool contract not available');
            }

            const contractWithSigner = contract.connect(signer);
            
            // Execute withdrawal
            const tx = await contractWithSigner.withdraw(
                zkProof.proof,
                withdrawData.root,
                withdrawData.nullifierHash,
                withdrawData.commitmentHash,
                withdrawData.recipient,
                withdrawData.relayer,
                withdrawData.fee,
                withdrawData.refund,
                {
                    gasLimit: 600000
                }
            );

            console.log('Withdrawal transaction submitted:', tx.hash);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            // Mark nullifier as spent
            this.nullifiers.add(withdrawData.nullifierHash);

            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                nullifierHash: withdrawData.nullifierHash,
                recipient: withdrawData.recipient,
                gasUsed: receipt.gasUsed.toString()
            };
            
        } catch (error) {
            console.error('Withdrawal failed:', error);
            throw new Error(`Withdrawal failed: ${error.message}`);
        }
    }

    /**
     * Check if nullifier is already spent
     * @param {String} nullifierHash - Nullifier hash to check
     * @param {Number} chainId - Chain ID
     * @returns {Boolean} - True if spent
     */
    async isNullifierSpent(nullifierHash, chainId) {
        try {
            // Check local cache first
            if (this.nullifiers.has(nullifierHash)) {
                return true;
            }

            // Check contract
            const contract = this.contracts.get(chainId);
            if (contract) {
                const isSpent = await contract.isSpent(nullifierHash);
                if (isSpent) {
                    this.nullifiers.add(nullifierHash);
                }
                return isSpent;
            }

            return false;
            
        } catch (error) {
            console.error('Nullifier check failed:', error);
            return false;
        }
    }

    /**
     * Get current Merkle tree root
     * @param {Number} chainId - Chain ID
     * @returns {String} - Current root
     */
    async getCurrentRoot(chainId) {
        try {
            const contract = this.contracts.get(chainId);
            if (!contract) {
                throw new Error('Contract not available');
            }

            const root = await contract.getLatestRoot();
            return root.toString();
            
        } catch (error) {
            console.error('Root fetch failed:', error);
            throw new Error(`Root fetch failed: ${error.message}`);
        }
    }

    /**
     * Encode swap data for contract
     * @param {Object} swapData - Swap parameters
     * @returns {String} - Encoded swap data
     */
    encodeSwapData(swapData) {
        try {
            // This would encode swap parameters according to your swap protocol
            // For now, return a simple encoding
            const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'address', 'uint256', 'uint256', 'bytes'],
                [
                    swapData.tokenIn || ethers.ZeroAddress,
                    swapData.tokenOut || ethers.ZeroAddress,
                    swapData.amountIn || '0',
                    swapData.minAmountOut || '0',
                    swapData.routerData || '0x'
                ]
            );
            
            return encoded;
            
        } catch (error) {
            console.error('Swap data encoding failed:', error);
            throw new Error(`Swap data encoding failed: ${error.message}`);
        }
    }

    /**
     * Get anonymity set size
     * @returns {Number} - Number of deposits in the pool
     */
    getAnonymitySetSize() {
        return this.commitments.length;
    }

    /**
     * Get service status
     * @returns {Object} - Service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            contractsLoaded: this.contracts.size,
            commitmentsLoaded: this.commitments.length,
            nullifiersTracked: this.nullifiers.size,
            merkleTreeReady: !!this.merkleTree,
            poseidonReady: !!this.poseidonHash,
            anonymitySetSize: this.getAnonymitySetSize()
        };
    }

    /**
     * Generate random secret and nullifier
     * @returns {Object} - Random values for commitment
     */
    generateRandomValues() {
        const secret = ethers.randomBytes(32);
        const nullifier = ethers.randomBytes(32);
        
        return {
            secret: ethers.hexlify(secret),
            nullifier: ethers.hexlify(nullifier)
        };
    }
}

export default new ShieldedPoolService();
