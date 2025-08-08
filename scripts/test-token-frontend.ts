import { ethers } from "ethers";

// Configuration - same as frontend
const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";
const STAR_TOKEN_ADDRESS = "0x5a8974CD95aa79D6bac9E5Eb71fEb5e98ed0168f";
const PURCHASE_CONTRACT_ADDRESS = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417";
const TEST_USER_ADDRESS = "0x550Ab7ee806D941F878A7379261956DfC66fAaf6";

// ERC20 ABI - same as frontend
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

async function testTokenContract() {
    try {
        console.log("🧪 Testing StarToken contract (frontend simulation)...");
        
        // Create provider (no signer needed for read operations)
        const provider = new ethers.JsonRpcProvider(INFURA_URL);
        
        // Create token contract instance
        const tokenContract = new ethers.Contract(STAR_TOKEN_ADDRESS, ERC20_ABI, provider);
        
        console.log(`Token Address: ${STAR_TOKEN_ADDRESS}`);
        console.log(`Test User: ${TEST_USER_ADDRESS}`);
        console.log(`Purchase Contract: ${PURCHASE_CONTRACT_ADDRESS}`);
        
        // Check if contract exists
        const code = await provider.getCode(STAR_TOKEN_ADDRESS);
        console.log(`Contract code length: ${code.length}`);
        
        if (code === "0x") {
            console.error("❌ No contract found at this address!");
            return;
        }
        
        console.log("✅ Contract exists at address");
        
        // Test basic token functions
        try {
            const [name, symbol, decimals] = await Promise.all([
                tokenContract.name(),
                tokenContract.symbol(),
                tokenContract.decimals()
            ]);
            
            console.log(`Token Name: ${name}`);
            console.log(`Token Symbol: ${symbol}`);
            console.log(`Decimals: ${decimals}`);
            
            // Test balance
            const balance = await tokenContract.balanceOf(TEST_USER_ADDRESS);
            console.log(`User balance: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
            
            // Test allowance (this is what's failing in frontend)
            console.log("Testing allowance...");
            const allowance = await tokenContract.allowance(TEST_USER_ADDRESS, PURCHASE_CONTRACT_ADDRESS);
            console.log(`Allowance for PurchaseLight: ${ethers.formatUnits(allowance, decimals)} ${symbol}`);
            
            console.log("\n✅ All token contract tests passed!");
            
        } catch (error) {
            console.error("❌ Token contract test failed:", error);
        }
        
    } catch (error) {
        console.error("❌ Error testing token contract:", error);
    }
}

testTokenContract(); 