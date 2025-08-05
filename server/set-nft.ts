import { ethers } from "ethers";
import { createClient } from "@libsql/client/web"; // or "bun" if you're using bun


const PURCHASE_CONTRACT_ADDRESS = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417"; // Replace this
const NEW_NFT_CONTRACT_ADDRESS = "0x6dbAE469973657930d7d9688b71305775DBBbC6f"; // NEW NFT contract address with correct authorized minter

const PURCHASE_CONTRACT_ABI = [
	"function setNftContract(address _nftAddress) public",
	"function nft() public view returns (address)",
];

const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2");

// Use a signer (private key or connected wallet)
const signer = new ethers.Wallet("e8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a", provider);

const purchaseContract = new ethers.Contract(
	PURCHASE_CONTRACT_ADDRESS,
	PURCHASE_CONTRACT_ABI,
	signer
);

async function updateNFTAddress() {
	try {
		const tx = await purchaseContract?.setNftContract(NEW_NFT_CONTRACT_ADDRESS);
		console.log("Transaction sent:", tx.hash);

		await tx.wait();
		console.log("NFT contract address updated!");
	} catch (error) {
		console.error("Failed to update NFT contract address:", error);
	}
}

updateNFTAddress();

// const nftAddress = await purchaseContract?.nft();
// console.log("NFT contract is set to:", nftAddress);
