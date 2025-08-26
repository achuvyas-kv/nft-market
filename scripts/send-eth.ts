import { ethers } from "hardhat";

async function main() {
    const SAFE_WALLET_ADDRESS = "0x0848a2cF7f15766788e04Eb47a50ce33eB37fc1a";
    const AMOUNT_ETH = "0.01"; // 0.01 ETH for gas fees
    
    const [deployer] = await ethers.getSigners();
    console.log("Sending ETH from account:", deployer.address);
    console.log("To Safe wallet:", SAFE_WALLET_ADDRESS);
    console.log("Amount:", AMOUNT_ETH, "ETH");

    // Check current balances
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    const safeBalance = await ethers.provider.getBalance(SAFE_WALLET_ADDRESS);
    
    console.log("\n=== Before Transfer ===");
    console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} ETH`);
    console.log(`Safe balance: ${ethers.formatEther(safeBalance)} ETH`);

    // Send ETH to Safe wallet
    const tx = await deployer.sendTransaction({
        to: SAFE_WALLET_ADDRESS,
        value: ethers.parseEther(AMOUNT_ETH)
    });

    console.log("\nTransaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    await tx.wait();
    console.log("✅ Transaction confirmed!");

    // Check balances after transfer
    const newDeployerBalance = await ethers.provider.getBalance(deployer.address);
    const newSafeBalance = await ethers.provider.getBalance(SAFE_WALLET_ADDRESS);

    console.log("\n=== After Transfer ===");
    console.log(`Deployer balance: ${ethers.formatEther(newDeployerBalance)} ETH`);
    console.log(`Safe balance: ${ethers.formatEther(newSafeBalance)} ETH`);

    console.log("\n🎉 Successfully sent", AMOUNT_ETH, "ETH to Safe wallet for gas fees!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 