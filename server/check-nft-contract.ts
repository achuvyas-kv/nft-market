import { ethers } from "ethers";

const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";
const PURCHASE_CONTRACT_ADDRESS = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417";

const PURCHASE_CONTRACT_ABI = [
    "function nft() view returns (address)",
    "function signer() view returns (address)",
    "function owner() view returns (address)"
];

async function checkNFTContract() {
    const provider = new ethers.JsonRpcProvider(INFURA_URL);
    const purchaseContract = new ethers.Contract(PURCHASE_CONTRACT_ADDRESS, PURCHASE_CONTRACT_ABI, provider);

    try {
        const [nftAddress, signerAddress, ownerAddress] = await Promise.all([
            purchaseContract.nft(),
            purchaseContract.signer(),
            purchaseContract.owner()
        ]);

        console.log("🔍 PurchaseLight Contract Status:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Purchase Contract:", PURCHASE_CONTRACT_ADDRESS);
        console.log("NFT Contract:", nftAddress);
        console.log("Signer Address:", signerAddress);
        console.log("Owner Address:", ownerAddress);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        if (nftAddress === "0x0000000000000000000000000000000000000000") {
            console.log("❌ NFT contract is NOT SET! This will cause 'Not authorized' errors.");
            console.log("💡 Solution: Call setNftContract() with the correct NFT contract address");
            return false;
        } else {
            console.log("✅ NFT contract is set correctly");
            return true;
        }
        
    } catch (error) {
        console.error("❌ Error checking contract:", error);
        return false;
    }
}

checkNFTContract(); 