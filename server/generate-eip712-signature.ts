import { ethers } from "ethers";

// Admin private key for signing (for testing purposes)
const ADMIN_PRIVATE_KEY = "0xe8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a"; // 0x78C80D61acC3BD220e0561904835CB9ba825CfC8

// Contract addresses (Updated to V6 - Buyer-agnostic EIP712)
const CROWN_PURCHASE_ADDRESS = "0xB7Aa678187441466e11B2EFCF6a9716AC7Bb840c";

// EIP712 domain (CrownPurchase contract)
const DOMAIN = {
    name: "CrownPurchase",
    version: "1",
    chainId: 11155111, // Sepolia
    verifyingContract: CROWN_PURCHASE_ADDRESS
};

// EIP712 types (buyer-agnostic)
const TYPES = {
    Transfer: [
        { name: "from", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "price", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" }
    ]
};

export interface TransferData {
    from: string;
    to: string; // still returned for convenience, not part of signature
    tokenId: number;
    price: string; // in wei
    deadline: number; // timestamp
    nonce: number;
}

export async function generateTransferSignature(transferData: TransferData): Promise<string> {
    try {
        const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY);

        const message = {
            from: transferData.from,
            tokenId: transferData.tokenId,
            price: transferData.price,
            deadline: transferData.deadline,
            nonce: transferData.nonce
        };

        const signature = await wallet.signTypedData(DOMAIN, TYPES, message);
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
            tokenId: transferData.tokenId,
            price: transferData.price,
            deadline: transferData.deadline,
            nonce: transferData.nonce
        }
    };
} 