import { ethers } from "hardhat";

const DARK_TOKEN_ADDRESS = "0x4d4C324C3a408476e25887025dDbA50839ECd7B1";

async function main() {
    // Get recipient address from environment variables or use default
    const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS || "0xAC3d82e0219c81C728109Ff9d8A745E6852F91c9";
    const AMOUNT_TO_SEND = process.env.AMOUNT || "50"; // Default to 50 DARK tokens
    
    // Validate recipient address
    if (!ethers.isAddress(RECIPIENT_ADDRESS)) {
        throw new Error(`Invalid recipient address: ${RECIPIENT_ADDRESS}`);
    }
    
    const [deployer] = await ethers.getSigners();
    console.log("Sending DARK tokens from account:", deployer.address);
    console.log("To recipient:", RECIPIENT_ADDRESS);
    console.log("Amount:", AMOUNT_TO_SEND, "DARK tokens");

    // Get the DarkToken contract instance
    const DarkToken = await ethers.getContractAt("DarkToken", DARK_TOKEN_ADDRESS);

    // Check current balances
    const deployerBalance = await DarkToken.balanceOf(deployer.address);
    const recipientBalance = await DarkToken.balanceOf(RECIPIENT_ADDRESS);
    
    console.log("\n=== Before Transfer ===");
    console.log(`Deployer balance: ${ethers.formatUnits(deployerBalance, 18)} DARK`);
    console.log(`Recipient balance: ${ethers.formatUnits(recipientBalance, 18)} DARK`);

    // Convert amount to wei (18 decimals)
    const amountInWei = ethers.parseUnits(AMOUNT_TO_SEND, 18);

    // Check if deployer has enough balance
    if (deployerBalance < amountInWei) {
        throw new Error(`Insufficient balance. Need ${AMOUNT_TO_SEND} DARK, have ${ethers.formatUnits(deployerBalance, 18)} DARK`);
    }

    // Send the tokens
    console.log("\nSending tokens...");
    const tx = await DarkToken.transfer(RECIPIENT_ADDRESS, amountInWei);
    console.log("Transaction hash:", tx.hash);

    // Wait for confirmation
    console.log("Waiting for confirmation...");
    await tx.wait();
    console.log("✅ Transaction confirmed!");

    // Check balances after transfer
    const newDeployerBalance = await DarkToken.balanceOf(deployer.address);
    const newRecipientBalance = await DarkToken.balanceOf(RECIPIENT_ADDRESS);

    console.log("\n=== After Transfer ===");
    console.log(`Deployer balance: ${ethers.formatUnits(newDeployerBalance, 18)} DARK`);
    console.log(`Recipient balance: ${ethers.formatUnits(newRecipientBalance, 18)} DARK`);

    console.log("\n🎉 Successfully sent", AMOUNT_TO_SEND, "DARK tokens to", RECIPIENT_ADDRESS);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 