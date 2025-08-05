import { ethers } from "ethers";

const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";
const STAR_TOKEN_ADDRESS = "0x46AB2cedc835Dd47a73590E132071c66fE75cAF6";
const PURCHASE_CONTRACT_ADDRESS = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417";
const USER_ADDRESS = "0x0A9d01A55Dd5b44Ed5AA6Be4667d62a7dFf52a01"; // The user trying to mint

const ERC20_ABI = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

async function checkUserAllowance() {
    const provider = new ethers.JsonRpcProvider(INFURA_URL);
    const starToken = new ethers.Contract(STAR_TOKEN_ADDRESS, ERC20_ABI, provider);

    try {
        const [allowance, balance, decimals, symbol] = await Promise.all([
            starToken.allowance(USER_ADDRESS, PURCHASE_CONTRACT_ADDRESS),
            starToken.balanceOf(USER_ADDRESS),
            starToken.decimals(),
            starToken.symbol()
        ]);

        console.log("🔍 User Token Allowance Check");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("User Address:", USER_ADDRESS);
        console.log("Token Contract:", STAR_TOKEN_ADDRESS);
        console.log("Spender Contract:", PURCHASE_CONTRACT_ADDRESS);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Balance: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
        console.log(`Allowance: ${ethers.formatUnits(allowance, decimals)} ${symbol}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        const tokenPrice = ethers.parseUnits("1", decimals); // 1 token
        
        if (balance >= tokenPrice) {
            console.log("✅ Sufficient balance for NFT purchase");
        } else {
            console.log("❌ Insufficient balance for NFT purchase");
        }
        
        if (allowance >= tokenPrice) {
            console.log("✅ Sufficient allowance for NFT purchase");
        } else {
            console.log("❌ Insufficient allowance - USER NEEDS TO APPROVE CONTRACT");
            console.log(`💡 Required allowance: ${ethers.formatUnits(tokenPrice, decimals)} ${symbol}`);
        }
        
    } catch (error) {
        console.error("❌ Error checking allowance:", error);
    }
}

checkUserAllowance(); 