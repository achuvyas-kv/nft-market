import { ethers } from "ethers";

// Configuration
const SIGNER_PRIVATE_KEY = "e8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a"; // Replace with your signer's private key
const RESALE_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // Update with deployed ResaleLight contract address

// Create signer from private key
const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);

// EIP-712 domain for ResaleLight contract
const DOMAIN = {
    name: "ResaleLight",
    version: "1",
    chainId: 11155111, // Sepolia testnet
    verifyingContract: RESALE_CONTRACT_ADDRESS
};

// EIP-712 types for ResaleListing
const TYPES = {
    ResaleListing: [
        { name: "seller", type: "address" },
        { name: "nftContract", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "price", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" }
    ]
};

export interface ResaleListingData {
    seller: string;
    nftContract: string;
    tokenId: number;
    price: string; // Wei amount as string
    deadline: number; // Unix timestamp
    nonce: number;
}

/**
 * Generate EIP-712 signature for NFT resale listing
 * @param listingData - Resale listing data
 * @returns Promise<string> - The signature
 */
export async function generateResaleSignature(listingData: ResaleListingData): Promise<string> {
    try {
        // Validate inputs
        if (!ethers.isAddress(listingData.seller)) {
            throw new Error("Invalid seller address");
        }
        if (!ethers.isAddress(listingData.nftContract)) {
            throw new Error("Invalid NFT contract address");
        }
        if (listingData.tokenId < 0) {
            throw new Error("Token ID must be non-negative");
        }
        if (listingData.nonce < 0) {
            throw new Error("Nonce must be non-negative");
        }
        if (listingData.deadline <= Math.floor(Date.now() / 1000)) {
            throw new Error("Deadline must be in the future");
        }

        // Create the listing object for EIP-712
        const listing = {
            seller: listingData.seller,
            nftContract: listingData.nftContract,
            tokenId: listingData.tokenId,
            price: listingData.price,
            deadline: listingData.deadline,
            nonce: listingData.nonce
        };

        console.log("Generating signature for listing:", listing);

        // Sign the typed data using EIP-712
        const signature = await signer.signTypedData(DOMAIN, TYPES, listing);

        console.log("Generated resale signature:", signature);
        
        return signature;
    } catch (error) {
        console.error("Error generating resale signature:", error);
        throw error;
    }
}

/**
 * Verify a resale signature (useful for testing)
 * @param signature - The signature to verify
 * @param listingData - Original listing data
 * @returns boolean - True if signature is valid
 */
export function verifyResaleSignature(signature: string, listingData: ResaleListingData): boolean {
    try {
        const listing = {
            seller: listingData.seller,
            nftContract: listingData.nftContract,
            tokenId: listingData.tokenId,
            price: listingData.price,
            deadline: listingData.deadline,
            nonce: listingData.nonce
        };

        // Recover the signer from the signature
        const recoveredSigner = ethers.verifyTypedData(DOMAIN, TYPES, listing, signature);
        
        // Check if it matches our signer's address
        const expectedSigner = signer.address;
        
        console.log("Expected signer:", expectedSigner);
        console.log("Recovered signer:", recoveredSigner);
        
        return recoveredSigner.toLowerCase() === expectedSigner.toLowerCase();
    } catch (error) {
        console.error("Error verifying resale signature:", error);
        return false;
    }
}

/**
 * Generate hash for a listing (for off-chain use)
 * @param listingData - Resale listing data
 * @returns string - The hash
 */
export function getListingHash(listingData: ResaleListingData): string {
    const listing = {
        seller: listingData.seller,
        nftContract: listingData.nftContract,
        tokenId: listingData.tokenId,
        price: listingData.price,
        deadline: listingData.deadline,
        nonce: listingData.nonce
    };

    return ethers.TypedDataEncoder.hash(DOMAIN, TYPES, listing);
}

// CLI usage when running this file directly
if (import.meta.main) {
    const args = process.argv.slice(2);
    
    if (args.length < 6) {
        console.log("Usage:");
        console.log("  bun resale-signature.ts <seller> <nftContract> <tokenId> <price> <deadline> <nonce>");
        console.log("");
        console.log("Example:");
        console.log("  bun resale-signature.ts 0x742d35Cc6635C0532925a3b8D24e3B2FCCD8b4dD 0x123... 1 1000000000000000000 1672531200 0");
        process.exit(1);
    }

    const listingData: ResaleListingData = {
        seller: args[0],
        nftContract: args[1],
        tokenId: parseInt(args[2]),
        price: args[3],
        deadline: parseInt(args[4]),
        nonce: parseInt(args[5])
    };
    
    generateResaleSignature(listingData)
        .then(signature => {
            console.log("\nResale signature generated:");
            console.log("Seller:", listingData.seller);
            console.log("NFT Contract:", listingData.nftContract);
            console.log("Token ID:", listingData.tokenId);
            console.log("Price:", listingData.price);
            console.log("Deadline:", new Date(listingData.deadline * 1000).toISOString());
            console.log("Nonce:", listingData.nonce);
            console.log("Signature:", signature);
            console.log("Hash:", getListingHash(listingData));
            
            // Verify the signature
            const isValid = verifyResaleSignature(signature, listingData);
            console.log("Verification:", isValid ? "✅ Valid" : "❌ Invalid");
        })
        .catch(console.error);
} 