
import './App.css';
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import LightNFT from '../../artifacts/contracts/LightNFT.sol/LightNFT.json';
import PurchaseLight from "../../artifacts/contracts/PurchaseLight.sol/PurchaseLight.json"

const CONTRACT_ADDRESS = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417" // PurchaseLight contract

const erc20Abi = [
	"function balanceOf(address owner) view returns (uint256)",
	"function transfer(address to, uint256 amount) returns (bool)",
	"function transferFrom(address from, address to, uint256 amount) returns (bool)",
	"function approve(address spender, uint256 amount) returns (bool)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"event Transfer(address indexed from, address indexed to, uint256 value)",
	"event Approval(address indexed owner, address indexed spender, uint256 value)"
];

export default function App() {
	const [account, setAccount] = useState("");
	const [status, setStatus] = useState("");
	const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);
	const [myNFTs, setMyNFTs] = useState<number[]>([]);


	// Connect wallet
	async function connectWallet() {
		if (!window.ethereum) return alert("Metamask not found");
		try {
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();
			const address = await signer.getAddress();
			setAccount(address);
			// await loadMyNFTs(signer, address);

			await loadMyNFTsFromBackend(address);
		} catch (e) {
			console.error(e);
		}
	}

	// Load NFTs owned by the connected account
	async function loadMyNFTs(signer: ethers.JsonRpcSigner, address: string) {
		try {
			const contract = new ethers.Contract(CONTRACT_ADDRESS, PurchaseLight.abi, signer);
			const owned: number[] = [];
			const nextTokenId = await contract.nextTokenId();

			for (let tokenId = 0; tokenId < nextTokenId; tokenId++) {
				const owner = await contract.ownerOf(tokenId).catch(() => null);
				if (owner && owner.toLowerCase() === address.toLowerCase()) {
					owned.push(tokenId);
				}
			}

			setMyNFTs(owned);
		} catch (err) {
			console.error("Failed to load NFTs:", err);
		}
	}


	async function loadMyNFTsFromBackend(address: string) {
		try {
			const response = await fetch(`http://localhost:3000/nfts?owner=${address}`);
			if (!response.ok) throw new Error("Failed to fetch NFTs from server");
			const data = await response.json();
			// Assuming the backend returns an array of NFTs with a `token_id` field
			const ownedTokenIds = data.map((nft: any) => parseInt(nft.token_id));
			setMyNFTs(ownedTokenIds);
		} catch (err) {
			console.error("Backend NFT load failed:", err);
		}
	}

	// Get signature from backend
	async function getSignature(userAddress: string) {
		try {
			const response = await fetch(`http://localhost:3000/generate-signature?address=${userAddress}`);
			if (!response.ok) throw new Error("Failed to get signature");
			const data = await response.json();
			return data.signature;
		} catch (err) {
			console.error("Failed to get signature:", err);
			throw err;
		}
	}

	async function mintNFT() {
		try {
			setStatus("Preparing mint...");
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();
			const userAddress = await signer.getAddress();
			const contract = new ethers.Contract(CONTRACT_ADDRESS, PurchaseLight.abi, signer);

			const metadataURI = "https://gist.githubusercontent.com/achuvyas-kv/64144080cc11ab0c49e40afdd8d0b0e9/raw/e9e2a9aaafcebd358d9cd7390e37620732a6f230/metadata.json";

			// 1️⃣ Get signature from backend
			setStatus("Getting signature...");
			const signature = await getSignature(userAddress);
			// const signature = "0x014b82c48d7acbdf7eeb4f80b3d81aa88fa8791fcd11c0401a31362dcff193c7346c2d7fd18d25ba27bc58299db49f4da8958bd5939c39b52069b06438eeea7b1b"
			console.log("Got signature:", signature);

			// 2️⃣ Check and approve tokens if needed
			setStatus("Checking token approval...");
			const tokenContract = new ethers.Contract("0x46AB2cedc835Dd47a73590E132071c66fE75cAF6", erc20Abi, signer);
			const allowance = await tokenContract.allowance(userAddress, CONTRACT_ADDRESS);
			const tokenPrice = ethers.parseUnits("1", 18); // 1 STK

			console.log("Current allowance:", ethers.formatUnits(allowance, 18));

			if (allowance < tokenPrice) {
				setStatus("Approving tokens...");
				const txApprove = await tokenContract.approve(CONTRACT_ADDRESS, tokenPrice);
				await txApprove.wait();
				console.log("Token approval confirmed");
			}

			// 3️⃣ Call buyNFT with signature
			setStatus("Minting NFT...");
			const tx = await contract.buyNFT(metadataURI, signature);

			setStatus("Confirming transaction...");
			await tx.wait();

			setStatus("NFT Minted Successfully! 🎉");
			console.log("NFT minted in tx:", tx.hash);

			await loadMyNFTsFromBackend(account);
		} catch (err) {
			console.error("Mint failed:", err);
			setStatus(`Minting failed: ${err instanceof Error ? err.message : "Unknown error"}`);
		}
	}

	const getSolscanUrl = (tokenId: number) =>
		`https://sepolia.etherscan.io/token/${CONTRACT_ADDRESS}?a=${tokenId}`;

	return (
		<div>
			<h2>LightNFT Minter</h2>
			<button onClick={connectWallet}>Connect Wallet</button>
			<p>Account: {account}</p>

			<button onClick={mintNFT}>Mint NFT</button>
			<p>Status: {status}</p>

			{mintedTokenId !== null && (
				<p>
					Minted Token ID: #{mintedTokenId} —{" "}
					<a href={getSolscanUrl(mintedTokenId)} target="_blank" rel="noopener noreferrer">
						View on Etherscan
					</a>
				</p>
			)}

			{myNFTs.length > 0 && (
				<div>
					<h3>My NFTs:</h3>
					<ul>
						{myNFTs.map((tokenId) => (
							<li key={tokenId}>
								Token #{tokenId} —{" "}
								<a href={getSolscanUrl(tokenId)} target="_blank" rel="noopener noreferrer">
									View
								</a>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
