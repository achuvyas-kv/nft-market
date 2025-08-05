import { generatePurchaseSignature, generateBatchSignatures } from "./generate-signature.js";
import { getUserNonce, getTokenPrice, getContractInfo } from "./contract-utils.js";

/**
 * Complete workflow to generate a signature for a user's NFT purchase
 * This function automatically fetches the current nonce and token price from the contract
 * @param userAddress - Address of the user who wants to buy NFT
 * @returns Promise<{signature: string, nonce: number, tokenPrice: string}>
 */
export async function generateUserSignature(userAddress: string) {
    try {
        console.log(`🔄 Generating signature for user: ${userAddress}`);
        
        // Fetch current nonce and token price from contract
        const [currentNonce, tokenPrice] = await Promise.all([
            getUserNonce(userAddress),
            getTokenPrice()
        ]);

        console.log(`📊 User's current nonce: ${currentNonce}`);
        console.log(`💰 Current token price: ${tokenPrice} wei`);

        // Generate signature
        const signature = await generatePurchaseSignature(userAddress, currentNonce, tokenPrice);

        const result = {
            userAddress,
            signature,
            nonce: currentNonce,
            tokenPrice,
            timestamp: new Date().toISOString()
        };

        console.log(`✅ Signature generated successfully!`);
        return result;
    } catch (error) {
        console.error("❌ Error in signature workflow:", error);
        throw error;
    }
}

/**
 * Generate multiple signatures for a user (useful for batch purchases)
 * @param userAddress - Address of the user
 * @param count - Number of signatures to generate
 * @returns Promise<Array<{signature: string, nonce: number, tokenPrice: string}>>
 */
export async function generateUserBatchSignatures(userAddress: string, count: number) {
    try {
        console.log(`🔄 Generating ${count} signatures for user: ${userAddress}`);
        
        // Fetch current nonce and token price from contract
        const [startNonce, tokenPrice] = await Promise.all([
            getUserNonce(userAddress),
            getTokenPrice()
        ]);

        console.log(`📊 Starting nonce: ${startNonce}`);
        console.log(`💰 Token price: ${tokenPrice} wei`);

        // Generate batch signatures
        const signatures = await generateBatchSignatures(userAddress, startNonce, count);

        const result = signatures.map(({nonce, signature}) => ({
            userAddress,
            signature,
            nonce,
            tokenPrice,
            timestamp: new Date().toISOString()
        }));

        console.log(`✅ ${count} signatures generated successfully!`);
        return result;
    } catch (error) {
        console.error("❌ Error in batch signature workflow:", error);
        throw error;
    }
}

/**
 * API endpoint data for signature generation
 * @param userAddress - Address of the user
 * @returns Promise<object> - Complete data for frontend/API use
 */
export async function getSignatureData(userAddress: string) {
    try {
        const [signatureData, contractInfo] = await Promise.all([
            generateUserSignature(userAddress),
            getContractInfo()
        ]);

        return {
            success: true,
            data: {
                signature: signatureData.signature,
                nonce: signatureData.nonce,
                userAddress: signatureData.userAddress,
                tokenPrice: signatureData.tokenPrice,
                contractAddress: contractInfo.contractAddress,
                timestamp: signatureData.timestamp
            },
            instructions: {
                message: "Use this signature to call buyNFT() function",
                parameters: {
                    _uri: "Your NFT metadata URI",
                    _signature: signatureData.signature
                },
                exampleCall: `buyNFT("https://example.com/metadata.json", "${signatureData.signature}")`
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString()
        };
    }
}

// CLI usage when running this file directly
if (import.meta.main) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log("🎯 NFT Purchase Signature Workflow");
        console.log("");
        console.log("Usage:");
        console.log("  bun signature-workflow.ts generate <userAddress>              - Generate single signature");
        console.log("  bun signature-workflow.ts batch <userAddress> <count>        - Generate batch signatures");
        console.log("  bun signature-workflow.ts api <userAddress>                  - Get API-ready signature data");
        console.log("");
        console.log("Examples:");
        console.log("  bun signature-workflow.ts generate 0x742d35Cc6635C0532925a3b8D24e3B2FCCD8b4dD");
        console.log("  bun signature-workflow.ts batch 0x742d35Cc6635C0532925a3b8D24e3B2FCCD8b4dD 3");
        console.log("  bun signature-workflow.ts api 0x742d35Cc6635C0532925a3b8D24e3B2FCCD8b4dD");
        process.exit(1);
    }

    const command = args[0];
    const userAddress = args[1];

    if (!userAddress) {
        console.log("❌ Error: User address is required");
        console.log("Usage: bun signature-workflow.ts <command> <userAddress> [options]");
        process.exit(1);
    }

    switch (command) {
        case "generate":
            generateUserSignature(userAddress)
                .then(result => {
                    console.log("\n🎉 Signature Generated:");
                    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    console.log("User Address:", result.userAddress);
                    console.log("Nonce:", result.nonce);
                    console.log("Token Price:", result.tokenPrice, "wei");
                    console.log("Signature:", result.signature);
                    console.log("Generated At:", result.timestamp);
                    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    console.log("\n📝 Usage:");
                    console.log(`buyNFT("your-metadata-uri.json", "${result.signature}")`);
                })
                .catch(console.error);
            break;

        case "batch":
            const count = parseInt(args[2] || "1");
            if (isNaN(count) || count <= 0) {
                console.log("❌ Error: Count must be a positive number");
                process.exit(1);
            }

            generateUserBatchSignatures(userAddress, count)
                .then(results => {
                    console.log(`\n🎉 ${count} Signatures Generated:`);
                    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    results.forEach((result, index) => {
                        console.log(`\n${index + 1}. Nonce ${result.nonce}:`);
                        console.log("   Signature:", result.signature);
                    });
                    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                })
                .catch(console.error);
            break;

        case "api":
            getSignatureData(userAddress)
                .then(result => {
                    console.log("\n📡 API Response:");
                    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    console.log(JSON.stringify(result, null, 2));
                    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                })
                .catch(console.error);
            break;

        default:
            console.log("❌ Unknown command:", command);
            console.log("Use 'bun signature-workflow.ts' to see available commands");
            process.exit(1);
    }
} 