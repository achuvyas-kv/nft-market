import { ethers } from "ethers";

// Configuration
const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";
const PRIVATE_KEY = "e8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a"; // Your private key
const STAR_TOKEN_ADDRESS = "0x5a8974CD95aa79D6bac9E5Eb71fEb5e98ed0168f"; // New StarToken contract address

// Test recipient address
const TEST_RECIPIENT = "0x550Ab7ee806D941F878A7379261956DfC66fAaf6";

// ERC20 ABI - Standard functions we need
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
];

async function sendNewTokens() {
    try {
        console.log("🚀 Sending new Star tokens to test address...");
        
        // Create provider and signer
        const provider = new ethers.JsonRpcProvider(INFURA_URL);
        const signer = new ethers.Wallet(PRIVATE_KEY, provider);
        
        // Create token contract instance
        const starToken = new ethers.Contract(STAR_TOKEN_ADDRESS, ERC20_ABI, signer);
        
        console.log(`From: ${signer.address}`);
        console.log(`To: ${TEST_RECIPIENT}`);
        
        // Get token info
        const [decimals, symbol, name] = await Promise.all([
            starToken.decimals(),
            starToken.symbol(),
            starToken.name()
        ]);
        
        console.log(`Token: ${name} (${symbol})`);
        
        // Amount to send (10 tokens for testing)
        const amountToSend = "10";
        const amountInWei = ethers.parseUnits(amountToSend, decimals);
        
        console.log(`Amount: ${amountToSend} ${symbol}`);
        
        // Check sender balance
        const senderBalance = await starToken.balanceOf(signer.address);
        console.log(`Sender balance: ${ethers.formatUnits(senderBalance, decimals)} ${symbol}`);
        
        if (senderBalance < amountInWei) {
            throw new Error(`Insufficient balance. Have: ${ethers.formatUnits(senderBalance, decimals)} ${symbol}, Need: ${amountToSend} ${symbol}`);
        }
        
        // Check recipient balance before
        const recipientBalanceBefore = await starToken.balanceOf(TEST_RECIPIENT);
        console.log(`Recipient balance before: ${ethers.formatUnits(recipientBalanceBefore, decimals)} ${symbol}`);
        
        // Execute transfer
        console.log("⏳ Sending transaction...");
        const tx = await starToken.transfer(TEST_RECIPIENT, amountInWei);
        console.log(`Transaction hash: ${tx.hash}`);
        
        // Wait for confirmation
        console.log("⏳ Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed! Block: ${receipt?.blockNumber}`);
        
        // Check final balances
        const [senderBalanceAfter, recipientBalanceAfter] = await Promise.all([
            starToken.balanceOf(signer.address),
            starToken.balanceOf(TEST_RECIPIENT)
        ]);
        
        console.log("\n📊 Final Balances:");
        console.log(`Sender: ${ethers.formatUnits(senderBalanceAfter, decimals)} ${symbol}`);
        console.log(`Recipient: ${ethers.formatUnits(recipientBalanceAfter, decimals)} ${symbol}`);
        
        console.log("\n🎉 New Star tokens sent successfully!");
        console.log(`Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`);
        
    } catch (error) {
        console.error("❌ Error sending new tokens:", error);
        process.exit(1);
    }
}

// Run the script
sendNewTokens(); 