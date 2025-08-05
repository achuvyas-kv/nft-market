// check-balance.js
import { ethers } from "ethers";

// Replace with your values
const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2")

const tokenAddress = "0x46AB2cedc835Dd47a73590E132071c66fE75cAF6";
const walletAddress = "0x78C80D61acC3BD220e0561904835CB9ba825CfC8";




// Minimal ERC20 ABI to get balance
const ERC20_ABI = [
	"function balanceOf(address) view returns (uint256)",
	"function decimals() view returns (uint8)",
	"function symbol() view returns (string)"
];

async function main() {
	const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

	const balance = await token.balanceOf(walletAddress);
	const decimals = await token.decimals();
	const symbol = await token.symbol();

	const formattedBalance = ethers.formatUnits(balance, decimals);
	console.log(`Balance of ${walletAddress}: ${formattedBalance} ${symbol}`);
}

main().catch(console.error);

