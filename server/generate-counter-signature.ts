import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// EIP712 Domain and Types
const DOMAIN = {
    name: "SignatureCounter",
    version: "1",
    chainId: 11155111, // Sepolia testnet
    verifyingContract: "", // Will be set when contract is deployed
};

const TYPES = {
    UpdateCount: [
        { name: "newCount", type: "uint256" },
        { name: "nonce", type: "uint256" },
    ],
};

interface UpdateCountData {
    newCount: string;
    nonce: string;
}

export async function generateCounterSignature(
    contractAddress: string,
    newCount: number,
    nonce: number,
    privateKey?: string
): Promise<{
    signature: string;
    data: UpdateCountData;
    domain: typeof DOMAIN;
    types: typeof TYPES;
}> {
    // Use provided private key or from environment
    const signerPrivateKey = privateKey || process.env.PRIVATE_KEY;
    
    if (!signerPrivateKey) {
        throw new Error("Private key not provided");
    }

    // Create wallet
    const wallet = new ethers.Wallet(signerPrivateKey);

    // Update domain with contract address
    const domain = {
        ...DOMAIN,
        verifyingContract: contractAddress,
    };

    // Prepare data
    const data: UpdateCountData = {
        newCount: newCount.toString(),
        nonce: nonce.toString(),
    };

    // Generate signature
    const signature = await wallet.signTypedData(domain, TYPES, data);

    console.log("=== EIP712 Signature Generation ===");
    console.log("Contract Address:", contractAddress);
    console.log("Signer Address:", wallet.address);
    console.log("New Count:", newCount);
    console.log("Nonce:", nonce);
    console.log("Signature:", signature);
    console.log("=====================================");

    return {
        signature,
        data,
        domain,
        types: TYPES,
    };
}

// CLI usage
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log("Usage: bun run generate-counter-signature.ts <contractAddress> <newCount> <nonce> [privateKey]");
        console.log("Example: bun run generate-counter-signature.ts 0x123... 42 1");
        process.exit(1);
    }

    const contractAddress = args[0];
    const newCountStr = args[1];
    const nonceStr = args[2];
    const privateKey = args[3];
    
    const newCount = parseInt(newCountStr || "");
    const nonce = parseInt(nonceStr || "");

    if (!contractAddress || isNaN(newCount) || isNaN(nonce)) {
        console.error("contractAddress, newCount and nonce must be valid");
        process.exit(1);
    }

    try {
        const result = await generateCounterSignature(contractAddress, newCount, nonce, privateKey);
        
        console.log("\n=== For Frontend Usage ===");
        console.log("Signature:", result.signature);
        console.log("New Count:", newCount);
        console.log("Nonce:", nonce);
        console.log("=========================");
        
    } catch (error) {
        console.error("Error generating signature:", error);
        process.exit(1);
    }
}

// API endpoint handler
export async function handleGenerateSignature(req: any, res: any) {
    try {
        const { contractAddress, newCount, nonce } = req.body;

        if (!contractAddress || newCount === undefined || nonce === undefined) {
            return res.status(400).json({
                error: "Missing required fields: contractAddress, newCount, nonce"
            });
        }

        if (typeof newCount !== 'number' || typeof nonce !== 'number') {
            return res.status(400).json({
                error: "newCount and nonce must be numbers"
            });
        }

        const result = await generateCounterSignature(contractAddress, newCount, nonce);

        res.json({
            signature: result.signature,
            newCount,
            nonce,
            domain: result.domain,
            types: result.types
        });

    } catch (error) {
        console.error("Signature generation failed:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Signature generation failed"
        });
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
} 