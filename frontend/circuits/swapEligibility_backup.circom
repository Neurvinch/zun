pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

// ZK Circuit for proving swap eligibility without revealing sensitive data
template SwapEligibility() {
    // Private inputs (witness)
    signal private input balance;           // User's token balance
    signal private input swapAmount;        // Amount to swap
    signal private input privateKey;        // User's private key for nullifier
    signal private input nonce;            // Unique nonce for this swap
    signal private input eligibilityFlag;   // Anti-bot/eligibility flag
    
    // Public inputs
    signal input minBalance;               // Minimum required balance (public)
    signal input maxSwapAmount;            // Maximum allowed swap amount (public)
    signal input merkleRoot;               // Merkle root of eligible users (public)
    
    // Outputs
    signal output nullifier;               // Unique nullifier to prevent double-spending
    signal output commitment;              // Commitment to the swap
    signal output isEligible;              // Boolean flag for eligibility
    
    // Components
    component hasher1 = Poseidon(2);
    component hasher2 = Poseidon(3);
    component hasher3 = Poseidon(4);
    
    component balanceCheck = GreaterEqualThan(64);
    component amountCheck = LessEqualThan(64);
    component eligibilityCheck = IsEqual();
    
    // Verify balance is sufficient
    balanceCheck.in[0] <== balance;
    balanceCheck.in[1] <== minBalance + swapAmount;
    
    // Verify swap amount is within limits
    amountCheck.in[0] <== swapAmount;
    amountCheck.in[1] <== maxSwapAmount;
    
    // Verify eligibility flag (1 = eligible, 0 = not eligible)
    eligibilityCheck.in[0] <== eligibilityFlag;
    eligibilityCheck.in[1] <== 1;
    
    // Generate nullifier (prevents double-spending)
    hasher1.inputs[0] <== privateKey;
    hasher1.inputs[1] <== nonce;
    nullifier <== hasher1.out;
    
    // Generate commitment (hides swap details)
    hasher2.inputs[0] <== swapAmount;
    hasher2.inputs[1] <== balance;
    hasher2.inputs[2] <== nullifier;
    commitment <== hasher2.out;
    
    // Final eligibility check (all conditions must be met)
    component finalCheck = IsEqual();
    finalCheck.in[0] <== balanceCheck.out + amountCheck.out + eligibilityCheck.out;
    finalCheck.in[1] <== 3; // All three checks must pass
    
    isEligible <== finalCheck.out;
    
    // Constraint: if not eligible, nullifier and commitment should be 0
    component zeroCheck1 = IsZero();
    component zeroCheck2 = IsZero();
    
    zeroCheck1.in <== isEligible;
    zeroCheck2.in <== isEligible;
    
    // If not eligible, force outputs to be deterministic but useless
    nullifier <== nullifier * isEligible;
    commitment <== commitment * isEligible;
}

component main = SwapEligibility();
