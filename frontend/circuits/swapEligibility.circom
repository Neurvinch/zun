pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

// ZK Circuit for proving swap eligibility without revealing sensitive data
template SwapEligibility() {
    // Private inputs (witness)
    signal input balance;
    signal input swapAmount;
    signal input privateKey;
    signal input nonce;
    signal input eligibilityFlag;
    
    // Public inputs
    signal input minBalance;
    signal input maxSwapAmount;
    signal input merkleRoot;
    
    // Outputs
    signal output nullifier;
    signal output commitment;
    signal output isEligible;
    
    // Components
    component hasher1 = Poseidon(2);
    component hasher2 = Poseidon(3);
    
    component balanceCheck = GreaterEqThan(64);
    component amountCheck = LessEqThan(64);
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
    
    signal temp_nullifier;
    temp_nullifier <== hasher1.out;
    
    // Generate commitment (hides swap details)
    hasher2.inputs[0] <== swapAmount;
    hasher2.inputs[1] <== balance;
    hasher2.inputs[2] <== temp_nullifier;
    
    signal temp_commitment;
    temp_commitment <== hasher2.out;
    
    // Final eligibility check (all conditions must be met)
    component finalCheck = IsEqual();
    finalCheck.in[0] <== balanceCheck.out + amountCheck.out + eligibilityCheck.out;
    finalCheck.in[1] <== 3; // All three checks must pass
    
    isEligible <== finalCheck.out;
    
    // If not eligible, force outputs to be deterministic but useless
    nullifier <== temp_nullifier * isEligible;
    commitment <== temp_commitment * isEligible;
}

component main {public [minBalance, maxSwapAmount, merkleRoot]} = SwapEligibility();