import { ethers } from "ethers";

// Admin private key for signing (for testing purposes)
const ADMIN_PRIVATE_KEY = "0xe8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a"; // 0x78C80D61acC3BD220e0561904835CB9ba825CfC8

// Contract addresses (Updated to V5 - Fixed Signature Verification)
const CROWN_PURCHASE_ADDRESS = "0x7836C0BD3A34Fc03415CCA04937f8c5E8c915FA3";

// EIP712 domain (now using CrownPurchase contract)
const DOMAIN = {
    name: "CrownPurchase",
    version: "1",
    chainId: 11155111, // Sepolia
    verifyingContract: CROWN_PURCHASE_ADDRESS
};

// EIP712 types
const TYPES = {
    Transfer: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "price", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" }
    ]
};

export interface TransferData {
    from: string;
    to: string;
    tokenId: number;
    price: string; // in wei
    deadline: number; // timestamp
    nonce: number;
}

export async function generateTransferSignature(transferData: TransferData): Promise<string> {
    try {
        // Create wallet from private key
        const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY);
        
        // Create the EIP712 message
        const message = {
            from: transferData.from,
            to: transferData.to,
            tokenId: transferData.tokenId,
            price: transferData.price,
            deadline: transferData.deadline,
            nonce: transferData.nonce
        };

        console.log("Signing EIP712 message:", message);
        console.log("Domain:", DOMAIN);
        console.log("Types:", TYPES);

        // Sign the typed data
        const signature = await wallet.signTypedData(DOMAIN, TYPES, message);
        
        console.log("Generated signature:", signature);
        return signature;
        
    } catch (error) {
        console.error("Failed to generate EIP712 signature:", error);
        throw error;
    }
}

export function getTransferTypedData(transferData: TransferData) {
    return {
        domain: DOMAIN,
        types: TYPES,
        message: {
            from: transferData.from,
            to: transferData.to,
            tokenId: transferData.tokenId,
            price: transferData.price,
            deadline: transferData.deadline,
            nonce: transferData.nonce
        }
    };
} 