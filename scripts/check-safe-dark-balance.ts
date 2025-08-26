import { ethers } from "hardhat";

async function main() {
    const SAFE_WALLET_ADDRESS = "0x0848a2cF7f15766788e04Eb47a50ce33eB37fc1a";
    const DARK_TOKEN_ADDRESS = "0x9740D146D20FCF8643274cCD4Db91210200c9ed4";
    
    console.log("Checking Safe wallet DARK token balance...");
    console.log("Safe address:", SAFE_WALLET_ADDRESS);
    console.log("DARK token address:", DARK_TOKEN_ADDRESS);
    
    // Create DARK token contract instance
    const darkTokenAbi = [
        "function balanceOf(address account) external view returns (uint256)",
        "function allowance(address owner, address spender) external view returns (uint256)"
    ];
    
    const darkContract = new ethers.Contract(DARK_TOKEN_ADDRESS, darkTokenAbi, ethers.provider);
    
    // Check DARK balance
    const darkBalance = await darkContract.balanceOf(SAFE_WALLET_ADDRESS);
    console.log(`DARK balance: ${ethers.formatUnits(darkBalance, 18)} DARK`);
    
    // Check allowance for Crown Purchase contract
    const CROWN_PURCHASE_ADDRESS = "0x7836C0BD3A34Fc03415CCA04937f8c5E8c915FA3";
    const allowance = await darkContract.allowance(SAFE_WALLET_ADDRESS, CROWN_PURCHASE_ADDRESS);
    console.log(`DARK allowance for Crown Purchase: ${ethers.formatUnits(allowance, 18)} DARK`);
    
    if (darkBalance === 0n) {
        console.log("❌ No DARK tokens found! Safe needs DARK tokens to purchase NFTs.");
    } else if (darkBalance < ethers.parseUnits("10", 18)) {
        console.log("⚠️  Low DARK balance. May not be enough to purchase NFTs (need ~10 DARK).");
    } else {
        console.log("✅ Safe has sufficient DARK tokens.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 