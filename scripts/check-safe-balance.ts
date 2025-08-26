import { ethers } from "hardhat";

async function main() {
    const SAFE_WALLET_ADDRESS = "0x0848a2cF7f15766788e04Eb47a50ce33eB37fc1a";
    
    console.log("Checking Safe wallet balance...");
    console.log("Safe address:", SAFE_WALLET_ADDRESS);
    
    // Check ETH balance
    const ethBalance = await ethers.provider.getBalance(SAFE_WALLET_ADDRESS);
    console.log(`ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
    
    if (ethBalance === 0n) {
        console.log("❌ No ETH found! Safe needs ETH for gas fees.");
    } else if (ethBalance < ethers.parseEther("0.001")) {
        console.log("⚠️  Very low ETH balance. May not be enough for gas fees.");
    } else {
        console.log("✅ Safe has sufficient ETH for gas fees.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 