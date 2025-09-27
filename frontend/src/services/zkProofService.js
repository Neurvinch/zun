import * as snarkjs from 'snarkjs';
import { poseidon } from 'poseidon-lite';
import CryptoJS from 'crypto-js';

class ZKProofService {
    constructor() {
        this.wasmPath = '/circuits/swapEligibility.wasm';
        this.zkeyPath = '/circuits/swapEligibility_final.zkey';
        this.vkeyPath = '/circuits/verification_key.json';
    }

    /**
     * Generate ZK proof for swap eligibility
     * @param {Object} privateInputs - Private witness data
     * @param {Object} publicInputs - Public inputs
     * @returns {Object} - Generated proof and public signals
     */
    async generateSwapProof(privateInputs, publicInputs) {
        try {
            // Validate inputs
            this.validateInputs(privateInputs, publicInputs);

            // Prepare circuit inputs
            const circuitInputs = {
                // Private inputs (witness)
                balance: privateInputs.balance.toString(),
                swapAmount: privateInputs.swapAmount.toString(),
                privateKey: privateInputs.privateKey.toString(),
                nonce: privateInputs.nonce.toString(),
                eligibilityFlag: privateInputs.eligibilityFlag.toString(),
                
                // Public inputs
                minBalance: publicInputs.minBalance.toString(),
                maxSwapAmount: publicInputs.maxSwapAmount.toString(),
                merkleRoot: publicInputs.merkleRoot.toString()
            };

            console.log('Generating ZK proof with inputs:', {
                ...circuitInputs,
                privateKey: '[HIDDEN]',
                balance: '[HIDDEN]'
            });

            // Generate witness
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                circuitInputs,
                this.wasmPath,
                this.zkeyPath
            );

            // Format proof for Solidity verification
            const solidityProof = this.formatProofForSolidity(proof);

            return {
                proof: solidityProof,
                publicSignals,
                nullifier: publicSignals[0],
                commitment: publicSignals[1],
                isEligible: publicSignals[2] === '1'
            };

        } catch (error) {
            console.error('ZK proof generation failed:', error);
            throw new Error(`Proof generation failed: ${error.message}`);
        }
    }

    /**
     * Verify ZK proof locally before submission
     * @param {Object} proof - Generated proof
     * @param {Array} publicSignals - Public signals
     * @returns {Boolean} - Verification result
     */
    async verifyProof(proof, publicSignals) {
        try {
            const vKey = await fetch(this.vkeyPath).then(res => res.json());
            
            const result = await snarkjs.groth16.verify(
                vKey,
                publicSignals,
                proof
            );

            console.log('Local proof verification:', result);
            return result;

        } catch (error) {
            console.error('Proof verification failed:', error);
            return false;
        }
    }

    /**
     * Generate nullifier for double-spend prevention
     * @param {String} privateKey - User's private key
     * @param {String} nonce - Unique nonce
     * @returns {String} - Nullifier hash
     */
    generateNullifier(privateKey, nonce) {
        return poseidon([BigInt(privateKey), BigInt(nonce)]).toString();
    }

    /**
     * Generate commitment for swap details
     * @param {String} swapAmount - Amount to swap
     * @param {String} balance - User balance
     * @param {String} nullifier - Generated nullifier
     * @returns {String} - Commitment hash
     */
    generateCommitment(swapAmount, balance, nullifier) {
        return poseidon([
            BigInt(swapAmount),
            BigInt(balance),
            BigInt(nullifier)
        ]).toString();
    }

    /**
     * Create secure random nonce
     * @returns {String} - Random nonce
     */
    generateNonce() {
        const randomBytes = CryptoJS.lib.WordArray.random(32);
        return CryptoJS.enc.Hex.stringify(randomBytes);
    }

    /**
     * Derive private key from wallet signature
     * @param {String} signature - Wallet signature
     * @returns {String} - Derived private key for ZK proofs
     */
    deriveZKPrivateKey(signature) {
        const hash = CryptoJS.SHA256(signature);
        return hash.toString(CryptoJS.enc.Hex);
    }

    /**
     * Format proof for Solidity contract verification
     * @param {Object} proof - Raw snarkjs proof
     * @returns {Object} - Formatted proof
     */
    formatProofForSolidity(proof) {
        return {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
            c: [proof.pi_c[0], proof.pi_c[1]]
        };
    }

    /**
     * Validate circuit inputs
     * @param {Object} privateInputs - Private inputs
     * @param {Object} publicInputs - Public inputs
     */
    validateInputs(privateInputs, publicInputs) {
        // Validate private inputs
        const requiredPrivate = ['balance', 'swapAmount', 'privateKey', 'nonce', 'eligibilityFlag'];
        for (const field of requiredPrivate) {
            if (privateInputs[field] === undefined || privateInputs[field] === null) {
                throw new Error(`Missing private input: ${field}`);
            }
        }

        // Validate public inputs
        const requiredPublic = ['minBalance', 'maxSwapAmount', 'merkleRoot'];
        for (const field of requiredPublic) {
            if (publicInputs[field] === undefined || publicInputs[field] === null) {
                throw new Error(`Missing public input: ${field}`);
            }
        }

        // Validate ranges
        if (BigInt(privateInputs.balance) < BigInt(privateInputs.swapAmount)) {
            throw new Error('Insufficient balance for swap');
        }

        if (BigInt(privateInputs.swapAmount) <= 0) {
            throw new Error('Swap amount must be positive');
        }

        if (privateInputs.eligibilityFlag !== 0 && privateInputs.eligibilityFlag !== 1) {
            throw new Error('Eligibility flag must be 0 or 1');
        }
    }

    /**
     * Batch generate multiple proofs (for testing/optimization)
     * @param {Array} inputs - Array of input objects
     * @returns {Array} - Array of generated proofs
     */
    async batchGenerateProofs(inputs) {
        const proofs = [];
        
        for (const input of inputs) {
            try {
                const proof = await this.generateSwapProof(
                    input.privateInputs,
                    input.publicInputs
                );
                proofs.push({ success: true, proof });
            } catch (error) {
                proofs.push({ success: false, error: error.message });
            }
        }

        return proofs;
    }
}

export default new ZKProofService();
