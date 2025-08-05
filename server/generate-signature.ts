import { ethers } from "ethers";

// Configuration
const SIGNER_PRIVATE_KEY = "e8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a"; // Replace with your signer's private key
const PURCHASE_CONTRACT_ADDRESS = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417"; // Your PurchaseLight contract address
const TOKEN_PRICE = "1000000000000000000"; // 1 token (18 decimals) - should match contract's tokenPrice

// Create signer from private key
const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);

/**
 * Generate signature for NFT purchase
 * @param userAddress - Address of the user who wants to buy NFT
 * @param nonce - Current nonce for the user (should be fetched from contract)
 * @param tokenPrice - Token price (optional, defaults to configured price)
 * @param contractAddress - Contract address (optional, defaults to configured address)
 * @returns Promise<string> - The signature
 */
export async function generatePurchaseSignature(
    userAddress: string,
    nonce: number,
    tokenPrice: string = TOKEN_PRICE,
    contractAddress: string = PURCHASE_CONTRACT_ADDRESS
): Promise<string> {
    try {
        // Validate inputs
        if (!ethers.isAddress(userAddress)) {
            throw new Error("Invalid user address");
        }
        if (!ethers.isAddress(contractAddress)) {
            throw new Error("Invalid contract address");
        }
        if (nonce < 0) {
            throw new Error("Nonce must be non-negative");
        }

        // Create message hash exactly as the contract does
        const messageHash = ethers.solidityPackedKeccak256(
            ["address", "uint256", "address", "uint256"],
            [userAddress, tokenPrice, contractAddress, nonce]
        );

        console.log("Message hash:", messageHash);

        // Sign the message hash (this automatically applies the Ethereum signed message prefix)
        const signature = await signer.signMessage(ethers.getBytes(messageHash));

        console.log("Generated signature:", signature);
        
        return signature;
    } catch (error) {
        console.error("Error generating signature:", error);
        throw error;
    }
}

/**
 * Generate multiple signatures for a user (batch generation)
 * @param userAddress - Address of the user
 * @param startNonce - Starting nonce
 * @param count - Number of signatures to generate
 * @returns Promise<Array<{nonce: number, signature: string}>>
 */
export async function generateBatchSignatures(
    userAddress: string,
    startNonce: number,
    count: number
): Promise<Array<{nonce: number, signature: string}>> {
    const signatures = [];
    
    for (let i = 0; i < count; i++) {
        const nonce = startNonce + i;
        const signature = await generatePurchaseSignature(userAddress, nonce);
        
        signatures.push({
            nonce,
            signature
        });
    }
    
    return signatures;
}

/**
 * Verify a signature (useful for testing)
 * @param signature - The signature to verify
 * @param userAddress - User address
 * @param nonce - Nonce used
 * @returns boolean - True if signature is valid
 */
export function verifySignature(
    signature: string,
    userAddress: string,
    nonce: number,
    tokenPrice: string = TOKEN_PRICE,
    contractAddress: string = PURCHASE_CONTRACT_ADDRESS
): boolean {
    try {
        // Recreate the message hash
        const messageHash = ethers.solidityPackedKeccak256(
            ["address", "uint256", "address", "uint256"],
            [userAddress, tokenPrice, contractAddress, nonce]
        );

        // Recover the signer from the signature
        const recoveredSigner = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
        
        // Check if it matches our signer's address
        const expectedSigner = signer.address;
        
        console.log("Expected signer:", expectedSigner);
        console.log("Recovered signer:", recoveredSigner);
        
        return recoveredSigner.toLowerCase() === expectedSigner.toLowerCase();
    } catch (error) {
        console.error("Error verifying signature:", error);
        return false;
    }
}

// CLI usage when running this file directly
if (import.meta.main) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log("Usage:");
        console.log("  bun generate-signature.ts <userAddress> <nonce> [tokenPrice] [contractAddress]");
        console.log("  bun generate-signature.ts batch <userAddress> <startNonce> <count>");
        console.log("");
        console.log("Examples:");
        console.log("  bun generate-signature.ts 0x742d35Cc6635C0532925a3b8D24e3B2FCCD8b4dD 0");
        console.log("  bun generate-signature.ts batch 0x742d35Cc6635C0532925a3b8D24e3B2FCCD8b4dD 0 5");
        process.exit(1);
    }

    if (args[0] === "batch") {
        // Batch generation
        const userAddress = args[1];
        const startNonce = parseInt(args[2]);
        const count = parseInt(args[3]);
        
        generateBatchSignatures(userAddress, startNonce, count)
            .then(signatures => {
                console.log("\nBatch signatures generated:");
                signatures.forEach(({nonce, signature}) => {
                    console.log(`Nonce ${nonce}: ${signature}`);
                });
            })
            .catch(console.error);
    } else {
        // Single signature generation
        const userAddress = args[0];
        const nonce = parseInt(args[1]);
        const tokenPrice = args[2] || TOKEN_PRICE;
        const contractAddress = args[3] || PURCHASE_CONTRACT_ADDRESS;
        
        generatePurchaseSignature(userAddress, nonce, tokenPrice, contractAddress)
            .then(signature => {
                console.log("\nSignature generated:");
                console.log("User:", userAddress);
                console.log("Nonce:", nonce);
                console.log("Token Price:", tokenPrice);
                console.log("Contract:", contractAddress);
                console.log("Signature:", signature);
                
                // Verify the signature
                const isValid = verifySignature(signature, userAddress, nonce, tokenPrice, contractAddress);
                console.log("Verification:", isValid ? "✅ Valid" : "❌ Invalid");
            })
            .catch(console.error);
    }
} 