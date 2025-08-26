import { ethers } from "ethers";

const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";
const NFT_CONTRACT_ADDRESS = "0x4c7Fcde62D6f8F8855FE295A3D8a12F6A7F1ba61"; // From our earlier check
const PURCHASE_CONTRACT_ADDRESS = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417";

const NFT_ABI = [
	"function authorizedMinter() view returns (address)"
];

async function checkAuthorizedMinter() {
	const provider = new ethers.JsonRpcProvider(INFURA_URL);
	const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);

	try {
		const authorizedMinter = await nftContract.authorizedMinter();

		console.log("🔍 LightNFT Authorization Check");
		console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.log("NFT Contract:", NFT_CONTRACT_ADDRESS);
		console.log("Authorized Minter:", authorizedMinter);
		console.log("Purchase Contract:", PURCHASE_CONTRACT_ADDRESS);
		console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

		if (authorizedMinter.toLowerCase() === PURCHASE_CONTRACT_ADDRESS.toLowerCase()) {
			console.log("✅ PurchaseLight contract IS authorized to mint NFTs");
		} else {
			console.log("❌ PurchaseLight contract is NOT authorized to mint NFTs");
			console.log("🚨 THIS IS THE PROBLEM!");
			console.log("");
			console.log("💡 SOLUTION:");
			console.log("The LightNFT contract needs to set the PurchaseLight contract");
			console.log("as the authorized minter. The owner of the LightNFT contract");
			console.log("needs to call setAuthorizedMinter() or similar function.");
		}

	} catch (error) {
		console.error("❌ Error checking authorized minter:", error);
	}
}

checkAuthorizedMinter(); 
