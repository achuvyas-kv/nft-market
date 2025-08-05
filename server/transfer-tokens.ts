import { ethers } from "ethers";

// Configuration
const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";
const PRIVATE_KEY = "e8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a"; // Your private key
const STAR_TOKEN_ADDRESS = "0x46AB2cedc835Dd47a73590E132071c66fE75cAF6"; // StarToken contract address

// ERC20 ABI - Standard functions we need
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

// Create provider and signer
const provider = new ethers.JsonRpcProvider(INFURA_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// Create token contract instance
const starToken = new ethers.Contract(STAR_TOKEN_ADDRESS, ERC20_ABI, signer);

/**
 * Transfer StarToken to a recipient
 * @param recipientAddress - Address to send tokens to
 * @param amount - Amount to send (in tokens, not wei)
 * @returns Promise<object> - Transaction result
 */
export async function transferStarToken(recipientAddress: string, amount: string) {
    try {
        console.log(`🔄 Initiating StarToken transfer...`);
        console.log(`From: ${signer.address}`);
        console.log(`To: ${recipientAddress}`);
        console.log(`Amount: ${amount} tokens`);

        // Validate recipient address
        if (!ethers.isAddress(recipientAddress)) {
            throw new Error("Invalid recipient address");
        }

        // Get token info
        const [decimals, symbol, name] = await Promise.all([
            starToken.decimals(),
            starToken.symbol(),
            starToken.name()
        ]);

        console.log(`📋 Token Info: ${name} (${symbol}) - ${decimals} decimals`);

        // Convert amount to wei (considering token decimals)
        const amountInWei = ethers.parseUnits(amount, decimals);
        console.log(`Amount in wei: ${amountInWei.toString()}`);

        // Check sender balance
        const senderBalance = await starToken.balanceOf(signer.address);
        console.log(`💰 Sender balance: ${ethers.formatUnits(senderBalance, decimals)} ${symbol}`);

        if (senderBalance < amountInWei) {
            throw new Error(`Insufficient balance. Have: ${ethers.formatUnits(senderBalance, decimals)} ${symbol}, Need: ${amount} ${symbol}`);
        }

        // Check recipient balance before transfer
        const recipientBalanceBefore = await starToken.balanceOf(recipientAddress);
        console.log(`📊 Recipient balance before: ${ethers.formatUnits(recipientBalanceBefore, decimals)} ${symbol}`);

        // Execute transfer
        console.log(`⏳ Sending transaction...`);
        const tx = await starToken.transfer(recipientAddress, amountInWei);
        console.log(`📤 Transaction sent: ${tx.hash}`);

        // Wait for confirmation
        console.log(`⏳ Waiting for confirmation...`);
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed! Block: ${receipt?.blockNumber}`);

        // Check balances after transfer
        const [senderBalanceAfter, recipientBalanceAfter] = await Promise.all([
            starToken.balanceOf(signer.address),
            starToken.balanceOf(recipientAddress)
        ]);

        console.log(`\n📊 Final Balances:`);
        console.log(`Sender: ${ethers.formatUnits(senderBalanceAfter, decimals)} ${symbol}`);
        console.log(`Recipient: ${ethers.formatUnits(recipientBalanceAfter, decimals)} ${symbol}`);

        return {
            success: true,
            transactionHash: tx.hash,
            blockNumber: receipt?.blockNumber,
            gasUsed: receipt?.gasUsed?.toString(),
            from: signer.address,
            to: recipientAddress,
            amount: amount,
            token: {
                address: STAR_TOKEN_ADDRESS,
                name,
                symbol,
                decimals
            },
            balances: {
                senderBefore: ethers.formatUnits(senderBalance, decimals),
                senderAfter: ethers.formatUnits(senderBalanceAfter, decimals),
                recipientBefore: ethers.formatUnits(recipientBalanceBefore, decimals),
                recipientAfter: ethers.formatUnits(recipientBalanceAfter, decimals)
            }
        };

    } catch (error) {
        console.error("❌ Transfer failed:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

/**
 * Check StarToken balance for an address
 * @param address - Address to check balance for
 * @returns Promise<object> - Balance information
 */
export async function checkStarTokenBalance(address: string) {
    try {
        if (!ethers.isAddress(address)) {
            throw new Error("Invalid address");
        }

        const [balance, decimals, symbol, name] = await Promise.all([
            starToken.balanceOf(address),
            starToken.decimals(),
            starToken.symbol(),
            starToken.name()
        ]);

        const formattedBalance = ethers.formatUnits(balance, decimals);

        return {
            success: true,
            address,
            balance: formattedBalance,
            balanceWei: balance.toString(),
            token: {
                address: STAR_TOKEN_ADDRESS,
                name,
                symbol,
                decimals
            }
        };
    } catch (error) {
        console.error("❌ Balance check failed:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

/**
 * Get transaction estimate (gas cost)
 * @param recipientAddress - Address to send tokens to
 * @param amount - Amount to send (in tokens)
 * @returns Promise<object> - Gas estimate
 */
export async function estimateTransferCost(recipientAddress: string, amount: string) {
    try {
        const decimals = await starToken.decimals();
        const amountInWei = ethers.parseUnits(amount, decimals);

        // Estimate gas
        const gasEstimate = await starToken.transfer.estimateGas(recipientAddress, amountInWei);
        
        // Get gas price
        const gasPrice = await provider.getFeeData();
        
        // Calculate cost
        const gasCostWei = gasEstimate * (gasPrice.gasPrice || 0n);
        const gasCostEth = ethers.formatEther(gasCostWei);

        return {
            success: true,
            gasEstimate: gasEstimate.toString(),
            gasPrice: gasPrice.gasPrice?.toString(),
            gasCostWei: gasCostWei.toString(),
            gasCostEth
        };
    } catch (error) {
        console.error("❌ Gas estimation failed:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

// CLI usage when running this file directly
if (import.meta.main) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log("🪙 StarToken Transfer Script");
        console.log("");
        console.log("Usage:");
        console.log("  bun transfer-tokens.ts transfer <recipient> <amount>     - Transfer tokens");
        console.log("  bun transfer-tokens.ts balance <address>                - Check balance");
        console.log("  bun transfer-tokens.ts estimate <recipient> <amount>    - Estimate gas cost");
        console.log("  bun transfer-tokens.ts my-balance                       - Check your balance");
        console.log("");
        console.log("Examples:");
        console.log("  bun transfer-tokens.ts transfer 0x78C80D61acC3BD220e0561904835CB9ba825CfC8 10");
        console.log("  bun transfer-tokens.ts balance 0x78C80D61acC3BD220e0561904835CB9ba825CfC8");
        console.log("  bun transfer-tokens.ts my-balance");
        console.log("");
        console.log("Token: StarToken");
        console.log("Address:", STAR_TOKEN_ADDRESS);
        console.log("Your address:", signer.address);
        process.exit(1);
    }

    const command = args[0];

    switch (command) {
        case "transfer":
            if (args.length < 3) {
                console.log("❌ Error: Recipient address and amount required");
                console.log("Usage: bun transfer-tokens.ts transfer <recipient> <amount>");
                process.exit(1);
            }
            
            const recipient = args[1];
            const amount = args[2];
            
            transferStarToken(recipient, amount)
                .then(result => {
                    if (result.success) {
                        console.log("\n🎉 Transfer Successful!");
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                        console.log("Transaction Hash:", result.transactionHash);
                        console.log("Block Number:", result.blockNumber);
                        console.log("Gas Used:", result.gasUsed);
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    } else {
                        console.log("\n❌ Transfer Failed:");
                        console.log(result.error);
                    }
                })
                .catch(console.error);
            break;

        case "balance":
            if (args.length < 2) {
                console.log("❌ Error: Address required");
                console.log("Usage: bun transfer-tokens.ts balance <address>");
                process.exit(1);
            }
            
            const address = args[1];
            checkStarTokenBalance(address)
                .then(result => {
                    if (result.success) {
                        console.log(`\n💰 Balance for ${result.address}:`);
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                        console.log(`Balance: ${result.balance} ${result.token.symbol}`);
                        console.log(`Token: ${result.token.name} (${result.token.symbol})`);
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    } else {
                        console.log("❌ Balance check failed:", result.error);
                    }
                })
                .catch(console.error);
            break;

        case "my-balance":
            checkStarTokenBalance(signer.address)
                .then(result => {
                    if (result.success) {
                        console.log(`\n💰 Your Balance:`);
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                        console.log(`Address: ${result.address}`);
                        console.log(`Balance: ${result.balance} ${result.token.symbol}`);
                        console.log(`Token: ${result.token.name} (${result.token.symbol})`);
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    } else {
                        console.log("❌ Balance check failed:", result.error);
                    }
                })
                .catch(console.error);
            break;

        case "estimate":
            if (args.length < 3) {
                console.log("❌ Error: Recipient address and amount required");
                console.log("Usage: bun transfer-tokens.ts estimate <recipient> <amount>");
                process.exit(1);
            }
            
            const estimateRecipient = args[1];
            const estimateAmount = args[2];
            
            estimateTransferCost(estimateRecipient, estimateAmount)
                .then(result => {
                    if (result.success) {
                        console.log(`\n⛽ Gas Estimate:`);
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                        console.log(`Gas Limit: ${result.gasEstimate}`);
                        console.log(`Gas Price: ${result.gasPrice} wei`);
                        console.log(`Total Cost: ${result.gasCostEth} ETH`);
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    } else {
                        console.log("❌ Gas estimation failed:", result.error);
                    }
                })
                .catch(console.error);
            break;

        default:
            console.log("❌ Unknown command:", command);
            console.log("Use 'bun transfer-tokens.ts' to see available commands");
            process.exit(1);
    }
} 