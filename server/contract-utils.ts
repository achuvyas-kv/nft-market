import { ethers } from "ethers";

// Configuration
const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";
const PURCHASE_CONTRACT_ADDRESS = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417"; // Your PurchaseLight contract address

// Contract ABI - only the functions we need
const PURCHASE_CONTRACT_ABI = [
    "function nonces(address user) view returns (uint256)",
    "function tokenPrice() view returns (uint256)",
    "function signer() view returns (address)",
    "function owner() view returns (address)",
    "function paymentToken() view returns (address)"
];

// Create provider
const provider = new ethers.JsonRpcProvider(INFURA_URL);

// Create contract instance
const purchaseContract = new ethers.Contract(
    PURCHASE_CONTRACT_ADDRESS,
    PURCHASE_CONTRACT_ABI,
    provider
);

/**
 * Get the current nonce for a user
 * @param userAddress - Address of the user
 * @returns Promise<number> - Current nonce for the user
 */
export async function getUserNonce(userAddress: string): Promise<number> {
    try {
        if (!ethers.isAddress(userAddress)) {
            throw new Error("Invalid user address");
        }

        const nonce = await purchaseContract.nonces(userAddress);
        return Number(nonce);
    } catch (error) {
        console.error("Error fetching user nonce:", error);
        throw error;
    }
}

/**
 * Get the current token price from the contract
 * @returns Promise<string> - Current token price in wei
 */
export async function getTokenPrice(): Promise<string> {
    try {
        const price = await purchaseContract.tokenPrice();
        return price.toString();
    } catch (error) {
        console.error("Error fetching token price:", error);
        throw error;
    }
}

/**
 * Get the current signer address from the contract
 * @returns Promise<string> - Current signer address
 */
export async function getSignerAddress(): Promise<string> {
    try {
        return await purchaseContract.signer();
    } catch (error) {
        console.error("Error fetching signer address:", error);
        throw error;
    }
}

/**
 * Get contract owner address
 * @returns Promise<string> - Owner address
 */
export async function getOwnerAddress(): Promise<string> {
    try {
        return await purchaseContract.owner();
    } catch (error) {
        console.error("Error fetching owner address:", error);
        throw error;
    }
}

/**
 * Get payment token address
 * @returns Promise<string> - Payment token address
 */
export async function getPaymentTokenAddress(): Promise<string> {
    try {
        return await purchaseContract.paymentToken();
    } catch (error) {
        console.error("Error fetching payment token address:", error);
        throw error;
    }
}

/**
 * Get all contract information
 * @returns Promise<object> - Object containing all contract info
 */
export async function getContractInfo() {
    try {
        const [tokenPrice, signerAddress, ownerAddress, paymentToken] = await Promise.all([
            getTokenPrice(),
            getSignerAddress(),
            getOwnerAddress(),
            getPaymentTokenAddress()
        ]);

        return {
            contractAddress: PURCHASE_CONTRACT_ADDRESS,
            tokenPrice,
            signerAddress,
            ownerAddress,
            paymentToken
        };
    } catch (error) {
        console.error("Error fetching contract info:", error);
        throw error;
    }
}

// CLI usage when running this file directly
if (import.meta.main) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log("Usage:");
        console.log("  bun contract-utils.ts info                     - Get contract information");
        console.log("  bun contract-utils.ts nonce <userAddress>      - Get user's current nonce");
        console.log("  bun contract-utils.ts price                    - Get current token price");
        console.log("");
        console.log("Examples:");
        console.log("  bun contract-utils.ts info");
        console.log("  bun contract-utils.ts nonce 0x742d35Cc6635C0532925a3b8D24e3B2FCCD8b4dD");
        process.exit(1);
    }

    const command = args[0];

    switch (command) {
        case "info":
            getContractInfo()
                .then(info => {
                    console.log("\n📋 Contract Information:");
                    console.log("Contract Address:", info.contractAddress);
                    console.log("Token Price:", ethers.formatEther(info.tokenPrice), "ETH");
                    console.log("Token Price (wei):", info.tokenPrice);
                    console.log("Signer Address:", info.signerAddress);
                    console.log("Owner Address:", info.ownerAddress);
                    console.log("Payment Token:", info.paymentToken);
                })
                .catch(console.error);
            break;

        case "nonce":
            if (args.length < 2) {
                console.log("Error: User address required");
                console.log("Usage: bun contract-utils.ts nonce <userAddress>");
                process.exit(1);
            }
            
            const userAddress = args[1];
            getUserNonce(userAddress)
                .then(nonce => {
                    console.log(`\n🔢 User Nonce Information:`);
                    console.log("User Address:", userAddress);
                    console.log("Current Nonce:", nonce);
                    console.log("Next Signature Nonce:", nonce);
                })
                .catch(console.error);
            break;

        case "price":
            getTokenPrice()
                .then(price => {
                    console.log("\n💰 Token Price Information:");
                    console.log("Price (wei):", price);
                    console.log("Price (ETH):", ethers.formatEther(price));
                })
                .catch(console.error);
            break;

        default:
            console.log("Unknown command:", command);
            console.log("Use 'bun contract-utils.ts' to see available commands");
            process.exit(1);
    }
} 