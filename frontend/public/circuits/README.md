# ZKVault Circuit Files

This directory contains the compiled ZK circuit files needed for proof generation.

## Required Files

In a production environment, you would need to compile the circom circuit and place the following files here:

1. **swapEligibility.wasm** - The compiled WebAssembly circuit
2. **swapEligibility_final.zkey** - The final proving key (after trusted setup)
3. **verification_key.json** - The verification key for proof verification

## Circuit Compilation Process

To compile the circuit in production:

```bash
# 1. Compile the circuit
circom circuits/swapEligibility.circom --r1cs --wasm --sym

# 2. Generate the proving key (requires trusted setup)
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# 3. Generate the zkey
snarkjs groth16 setup swapEligibility.r1cs pot12_final.ptau swapEligibility_0000.zkey
snarkjs zkey contribute swapEligibility_0000.zkey swapEligibility_0001.zkey --name="1st Contributor Name" -v
snarkjs zkey export verificationkey swapEligibility_0001.zkey verification_key.json

# 4. Copy files to public directory
cp swapEligibility.wasm public/circuits/
cp swapEligibility_0001.zkey public/circuits/swapEligibility_final.zkey
cp verification_key.json public/circuits/
```

## Security Notes

- The trusted setup ceremony should be performed with multiple participants
- The proving key should be generated in a secure environment
- The verification key can be public and should be used by the smart contract
- Never expose the toxic waste from the trusted setup

## File Sizes

- swapEligibility.wasm: ~2-5 MB
- swapEligibility_final.zkey: ~50-100 MB (depending on circuit complexity)
- verification_key.json: ~1-2 KB

## Development Mode

For development and testing, you can use mock files or simplified circuits. The current implementation includes fallback handling for missing circuit files.
