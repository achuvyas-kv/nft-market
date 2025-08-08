import { ethers } from "ethers";

// Configuration
const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";
const STAR_TOKEN_ADDRESS = "0x46AB2cedc835Dd47a73590E132071c66fE75cAF6";

// ERC20 ABI
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
];

async function checkToken() {
    try {
        console.log("🔍 Checking StarToken contract...");
        
        const provider = new ethers.JsonRpcProvider(INFURA_URL);
        const tokenContract = new ethers.Contract(STAR_TOKEN_ADDRESS, ERC20_ABI, provider);
        
        console.log(`Token Address: ${STAR_TOKEN_ADDRESS}`);
        
        // Check if contract exists
        const code = await provider.getCode(STAR_TOKEN_ADDRESS);
        if (code === "0x") {
            console.error("❌ No contract found at this address!");
            return;
        }
        
        console.log("✅ Contract exists at address");
        
        // Get token info
        const [name, symbol, decimals] = await Promise.all([
            tokenContract.name(),
            tokenContract.symbol(),
            tokenContract.decimals()
        ]);
        
        console.log(`Token Name: ${name}`);
        console.log(`Token Symbol: ${symbol}`);
        console.log(`Decimals: ${decimals}`);
        
        // Check some balances
        const testAddress = "0x78C80D61acC3BD220e0561904835CB9ba825CfC8";
        const balance = await tokenContract.balanceOf(testAddress);
        console.log(`Balance of ${testAddress}: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
        
        // Check allowance
        const resaleContract = "0xdE377cD4085F56104655bF15636c295723db86f8";
        const allowance = await tokenContract.allowance(testAddress, resaleContract);
        console.log(`Allowance for ResaleLight: ${ethers.formatUnits(allowance, decimals)} ${symbol}`);
        
        console.log("\n✅ Token contract is working properly!");
        
    } catch (error) {
        console.error("❌ Error checking token:", error);
    }
}

checkToken(); 