
import './App.css';
import { useState } from 'react';
import { ethers } from 'ethers';
import CrownNFTSimple from "../../artifacts/contracts/CrownNFTSimple.sol/CrownNFTSimple.json";
import CrownPurchase from "../../artifacts/contracts/CrownPurchase.sol/CrownPurchase.json";
import DarkToken from "../../artifacts/contracts/DarkToken.sol/DarkToken.json";

// Safe Protocol Kit temporarily disabled due to compatibility issues
import Safe from '@safe-global/protocol-kit';
// import type { MetaTransactionData } from '@safe-global/types-kit';
// import { OperationType } from '@safe-global/types-kit';


// Add ethereum to window object
declare global {
	interface Window {
		ethereum?: any;
	}
}

// Deployed contract addresses (Updated to V5 - Fixed Signature Verification)
const CROWN_NFT_ADDRESS = "0x602158126D46767D1e0B7eA91F246a1dbE06C71D"; // New V5 Clean NFT Contract
const CROWN_PURCHASE_ADDRESS = "0x7836C0BD3A34Fc03415CCA04937f8c5E8c915FA3"; // New V5 Marketplace Contract (Fixed)
const DARK_TOKEN_ADDRESS = "0x9740D146D20FCF8643274cCD4Db91210200c9ed4";

// Backend API base URL
const API_BASE_URL = "http://localhost:3000";

interface NFT {
	tokenId: number;
	owner: string;
	metadata?: string;
	listing_price?: string;
	is_listed?: boolean;
	listing_deadline?: number;
}

export default function App() {
	const [activeTab, setActiveTab] = useState<'my-nfts' | 'all-nfts'>('my-nfts');
	const [account, setAccount] = useState("");
	const [mintStatus, setMintStatus] = useState("");
	const [myNFTs, setMyNFTs] = useState<NFT[]>([]);
	const [allNFTs, setAllNFTs] = useState<NFT[]>([]);
	const [darkBalance, setDarkBalance] = useState("");
	const [nftPrice, setNftPrice] = useState("");
	const [safeAddress, setSafeAddress] = useState("");

	const connectWallet = async () => {
		if (!window.ethereum) return alert("Metamask not found");
		try {
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();
			const address = await signer.getAddress();

			// Check network
			const network = await provider.getNetwork();
			console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);

			if (network.chainId !== 11155111n) {
				setMintStatus(`❌ Wrong network! Please switch to Sepolia. Current: ${network.name} (${network.chainId})`);
				setTimeout(() => setMintStatus(""), 8000);
				return;
			}

			await checkSmartWallet(address);

			setAccount(address);
			console.log(`Wallet connected: ${address}`);
			console.log("Contract addresses:");
			console.log("- CrownNFT:", CROWN_NFT_ADDRESS);
			console.log("- CrownPurchase:", CROWN_PURCHASE_ADDRESS);
			console.log("- DarkToken:", DARK_TOKEN_ADDRESS);

			await loadUserData(address, provider);
		} catch (e) {
			console.error("Wallet connection failed:", e);
			setMintStatus(`❌ Wallet connection failed: ${e instanceof Error ? e.message : "Unknown error"}`);
			setTimeout(() => setMintStatus(""), 5000);
		}
	};



	async function checkSmartWallet(walletAddress: String) {

		try {
			const apiUrl = "https://safe-transaction-sepolia.safe.global";
			const res = await fetch(`${apiUrl}/api/v1/owners/${walletAddress}/safes/`);
			const data = await res.json();

			if (data.safes && data.safes.length > 0) {
				const safeAddress = data.safes[0]; // Just taking the first one for now
				console.log(`✅ Smart wallet (Safe) found: ${safeAddress}`);

				setSafeAddress(safeAddress)



				// Optionally store this in state
				// setSmartWallet(safeAddress);
			} else {
				console.log("❌ No smart wallet (Safe) found for this address.");
			}
		} catch (e) {
			console.log(e)
		}



	}

	const loadUserData = async (address: string, provider: ethers.BrowserProvider) => {
		try {
			// Validate contract addresses first
			const darkTokenCode = await provider.getCode(DARK_TOKEN_ADDRESS);
			const purchaseContractCode = await provider.getCode(CROWN_PURCHASE_ADDRESS);

			if (darkTokenCode === "0x") {
				console.error("DARK token contract not found at address:", DARK_TOKEN_ADDRESS);
				setMintStatus("❌ DARK token contract not found. Please check network.");
				setTimeout(() => setMintStatus(""), 5000);
				return;
			}

			if (purchaseContractCode === "0x") {
				console.error("Crown Purchase contract not found at address:", CROWN_PURCHASE_ADDRESS);
				setMintStatus("❌ Crown Purchase contract not found. Please check network.");
				setTimeout(() => setMintStatus(""), 5000);
				return;
			}

			// Load DARK token balance
			try {
				const darkContract = new ethers.Contract(DARK_TOKEN_ADDRESS, DarkToken.abi, provider);
				const balance = await darkContract.balanceOf(address);
				setDarkBalance(ethers.formatUnits(balance, 18));
				console.log(`DARK balance loaded: ${ethers.formatUnits(balance, 18)}`);
			} catch (err) {
				console.error("Failed to load DARK balance:", err);
				setDarkBalance("0");
			}

			// Load NFT price
			try {
				const purchaseContract = new ethers.Contract(CROWN_PURCHASE_ADDRESS, CrownPurchase.abi, provider);
				const price = await purchaseContract.getNFTPrice();
				setNftPrice(ethers.formatUnits(price, 18));
				console.log(`NFT price loaded: ${ethers.formatUnits(price, 18)}`);
			} catch (err) {
				console.error("Failed to load NFT price:", err);
				setNftPrice("10"); // Default price
			}

			// Load NFTs from backend APIs
			await loadNFTsFromBackend(address);
		} catch (err) {
			console.error("Failed to load user data:", err);
			setMintStatus(`❌ Failed to load user data: ${err instanceof Error ? err.message : "Unknown error"}`);
			setTimeout(() => setMintStatus(""), 5000);
		}
	};

	const loadNFTsFromBackend = async (userAddress: string) => {
		try {
			// Load user's NFTs from backend
			const userNFTsResponse = await fetch(`${API_BASE_URL}/nfts?owner=${userAddress}`);
			if (userNFTsResponse.ok) {
				const userNFTsData = await userNFTsResponse.json();
				const userNFTs: NFT[] = userNFTsData.map((nft: any) => ({
					tokenId: parseInt(nft.token_id),
					owner: userAddress,
					metadata: nft.metadata_uri || `https://example.com/metadata/${nft.token_id}`
				}));
				setMyNFTs(userNFTs);
				console.log(`Loaded ${userNFTs.length} user NFTs from backend`);
			} else {
				console.error("Failed to load user NFTs from backend");
				setMyNFTs([]);
			}

			// Load all NFTs from backend
			const allNFTsResponse = await fetch(`${API_BASE_URL}/all-nfts`);
			if (allNFTsResponse.ok) {
				const allNFTsData = await allNFTsResponse.json();
				const allNFTs: NFT[] = allNFTsData.map((nft: any) => ({
					tokenId: parseInt(nft.token_id),
					owner: nft.owner_address,
					metadata: nft.metadata_uri || `https://example.com/metadata/${nft.token_id}`,
					listing_price: nft.listing_price,
					is_listed: !!nft.is_listed,
					listing_deadline: nft.listing_deadline
				}));
				setAllNFTs(allNFTs);
				console.log(`Loaded ${allNFTs.length} total NFTs from backend`);
			} else {
				console.error("Failed to load all NFTs from backend");
				setAllNFTs([]);
			}
		} catch (err) {
			console.error("Failed to load NFTs from backend:", err);
			// Fallback to empty arrays
			setMyNFTs([]);
			setAllNFTs([]);
		}
	};

	const mintNFT = async () => {
		if (!account) {
			alert("Please connect your wallet first");
			return;
		}

		try {
			setMintStatus("Preparing mint...");
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();



			// Validate contracts exist
			const darkTokenCode = await provider.getCode(DARK_TOKEN_ADDRESS);
			const purchaseContractCode = await provider.getCode(CROWN_PURCHASE_ADDRESS);

			if (darkTokenCode === "0x") {
				throw new Error("DARK token contract not found. Please check you're on Sepolia network.");
			}

			if (purchaseContractCode === "0x") {
				throw new Error("Crown Purchase contract not found. Please check you're on Sepolia network.");
			}

			const darkContract = new ethers.Contract(DARK_TOKEN_ADDRESS, DarkToken.abi, signer);
			const purchaseContract = new ethers.Contract(CROWN_PURCHASE_ADDRESS, CrownPurchase.abi, signer);

			// Get current price
			setMintStatus("Getting NFT price...");
			const price = await purchaseContract.getNFTPrice();
			console.log(`Current NFT price: ${ethers.formatUnits(price, 18)} DARK`);

			// Check balance
			setMintStatus("Checking DARK balance...");
			const balance = await darkContract.balanceOf(account);
			console.log(`User balance: ${ethers.formatUnits(balance, 18)} DARK`);

			if (balance < price) {
				throw new Error(`Insufficient DARK tokens. Need ${ethers.formatUnits(price, 18)} DARK, have ${ethers.formatUnits(balance, 18)} DARK`);
			}

			// Check allowance
			setMintStatus("Checking token approval...");

			const allowance = await darkContract.allowance(account, CROWN_PURCHASE_ADDRESS);

			console.log(`Current allowance: ${ethers.formatUnits(allowance, 18)} DARK`);

			if (allowance < price) {
				setMintStatus("Approving DARK tokens...");
				const txApprove = await darkContract.approve(CROWN_PURCHASE_ADDRESS, price);
				console.log("Approval transaction sent:", txApprove.hash);
				await txApprove.wait();
				console.log("Approval confirmed");
			}

			// Mint NFT
			setMintStatus("Minting CrownNFT...");
			const metadataURI = "https://gist.githubusercontent.com/achuvyas-kv/64144080cc11ab0c49e40afdd8d0b0e9/raw/e9e2a9aaafcebd358d9cd7390e37620732a6f230/metadata.json";
			const tx = await purchaseContract.buyNFT(metadataURI);
			console.log("Mint transaction sent:", tx.hash);

			setMintStatus("Confirming transaction...");
			const receipt = await tx.wait();
			console.log("Transaction confirmed:", receipt);

			setMintStatus("CrownNFT Minted Successfully! 🎉");
			console.log("NFT minted in tx:", tx.hash);

			// Reload data from backend (the server should have caught the Transfer event)
			setTimeout(async () => {
				await loadUserData(account, provider);
			}, 2000); // Wait 2 seconds for the event to be processed

		} catch (err) {
			console.error("Mint failed:", err);
			setMintStatus(`❌ Minting failed: ${err instanceof Error ? err.message : "Unknown error"}`);
			setTimeout(() => setMintStatus(""), 5000);
		}
	};




	const safeMintNFT = async () => {
		try {
			if (!account || !safeAddress) {
				alert("Please connect your wallet and Safe first");
				return;
			}
			const signerAddress = await window.ethereum.request({
				method: 'eth_requestAccounts'
			})[0]

			// Connect to an existing Safe  
			const protocolKit = await Safe.init({
				provider: window.ethereum, // or your web3 provider  
				signer: signerAddress, // connected wallet address  
				safeAddress: safeAddress // the Safe address to connect to  
			})

			// Get the SafeProvider instance  
			const safeProvider = protocolKit.getSafeProvider()
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner(); // This is the MetaMask EOA address 

			//
			// // if (allowance < price) {
			// // 	setMintStatus("Approving DARK tokens...");
			// // 	const txApprove = await darkContract.approve(CROWN_PURCHASE_ADDRESS, price);
			// // 	console.log("Approval transaction sent:", txApprove.hash);
			// // 	await txApprove.wait();
			// // 	console.log("Approval confirmed");
			// // }
			//
			//
			const darkContract = new ethers.Contract(DARK_TOKEN_ADDRESS, DarkToken.abi, signer);
			//
			// // Read allowance using SafeProvider.call()  
			// const allowanceCallData = darkContract.interface.encodeFunctionData('allowance', [
			// 	safeAddress, // Use Safe address instead of EOA account  
			// 	CROWN_PURCHASE_ADDRESS
			// ])
			//
			// const allowanceResult = await safeProvider.call({
			// 	from: safeAddress,
			// 	to: DARK_TOKEN_ADDRESS,
			// 	data: allowanceCallData
			// })
			//
			const purchaseContract = new ethers.Contract(CROWN_PURCHASE_ADDRESS, CrownPurchase.abi, signer);
			//
			// const price = await purchaseContract.getNFTPrice();
			//
			//
			// // Create the approval transaction data  
			// const approvalTransaction = {
			// 	to: DARK_TOKEN_ADDRESS,
			// 	value: '0',
			// 	data: darkContract.interface.encodeFunctionData('approve', [
			// 		CROWN_PURCHASE_ADDRESS,
			// 		price
			// 	])
			// }
			//
			// // Create Safe transaction  
			// const safeTransaction = await protocolKit.createTransaction({
			// 	transactions: [approvalTransaction]
			// })
			//
			// // Sign the transaction  
			// const signedTransaction = await protocolKit.signTransaction(safeTransaction)
			//
			// // Execute the transaction  
			// const txResponse = await protocolKit.executeTransaction(signedTransaction)
			// console.log("Approval transaction sent:", txResponse.hash)
			//
			// // Wait for confirmation  
			// if (txResponse.transactionResponse) {
			// 	const receipt = await txResponse.transactionResponse.wait()
			// 	console.log(receipt, "Approval confirmed")
			// }
			//
			//
			//
			//
			const metadataURI = "https://gist.githubusercontent.com/achuvyas-kv/64144080cc11ab0c49e40afdd8d0b0e9/raw/e9e2a9aaafcebd358d9cd7390e37620732a6f230/metadata.json";
			// const tx = await purchaseContract.buyNFT(metadataURI);
			// console.log("Mint transaction sent:", tx.hash);
			//
			// setMintStatus("Confirming transaction...");
			// const receipt = await tx.wait();
			//
			//
			const mintTransaction = {
				to: CROWN_PURCHASE_ADDRESS,
				value: '0',
				data: purchaseContract.interface.encodeFunctionData('buyNFT', [metadataURI])
			}
			const safeTransaction = await protocolKit.createTransaction({
				transactions: [mintTransaction]
			})

			// Sign the transaction  
			const signedTransaction = await protocolKit.signTransaction(safeTransaction)

			// Execute the transaction  
			const txResponse = await protocolKit.executeTransaction(signedTransaction)
			console.log("Mint transaction sent:", txResponse.hash)

			setMintStatus("Confirming transaction...");
			if (txResponse.transactionResponse) {
				const receipt = await txResponse.transactionResponse.wait()
				console.log("Transaction confirmed:", receipt)
			}

			setMintStatus("CrownNFT Minted Successfully! 🎉");
			console.log("NFT minted in tx:", txResponse.hash)

		} catch (err) {
			console.error("Safe mint failed:", err);
		}
	};



	const syncDatabase = async () => {
		try {
			setMintStatus("Syncing database...");
			const response = await fetch(`${API_BASE_URL}/sync`);
			if (response.ok) {
				const result = await response.json();
				setMintStatus(`✅ Sync completed: ${result.eventsProcessed} events processed`);

				// Reload NFTs after sync
				if (account) {
					await loadNFTsFromBackend(account);
				}
			} else {
				throw new Error("Sync request failed");
			}
		} catch (err) {
			console.error("Sync failed:", err);
			setMintStatus(`❌ Sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
			setTimeout(() => setMintStatus(""), 5000);
		}

		// Clear status after 3 seconds
		setTimeout(() => setMintStatus(""), 3000);
	};

	const debugDatabase = async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/debug-db`);
			if (response.ok) {
				const result = await response.json();
				console.log("Database debug info:", result);
				alert(`Database Debug:\n- Owners: ${result.ownersCount}\n- CrownNFTs: ${result.crownNftsCount}\n- Contract: ${result.contractAddress}`);
			} else {
				throw new Error("Debug request failed");
			}
		} catch (err) {
			console.error("Debug failed:", err);
			alert(`Debug failed: ${err instanceof Error ? err.message : "Unknown error"}`);
		}
	};

	const listNFTForResale = async (tokenId: number) => {
		if (!account) {
			alert("Please connect your wallet first");
			return;
		}

		const price = prompt("Enter price in DARK tokens:", "10");
		if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
			alert("Please enter a valid price");
			return;
		}

		try {
			setMintStatus(`Preparing to list NFT #${tokenId}...`);

			// Convert price to wei (18 decimals)
			const priceInWei = ethers.parseUnits(price, 18).toString();

			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();

			// Get current nonce for the seller
			const purchaseContract = new ethers.Contract(CROWN_PURCHASE_ADDRESS, CrownPurchase.abi, provider);
			const nonce = await purchaseContract.nonces(account);

			// Set deadline to 24 hours from now
			const deadline = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

			// Create EIP712 domain and types for listing authorization
			const domain = {
				name: "CrownMarketplace",
				version: "1",
				chainId: 11155111, // Sepolia
				verifyingContract: CROWN_PURCHASE_ADDRESS
			};

			const types = {
				ListingAuthorization: [
					{ name: "seller", type: "address" },
					{ name: "tokenId", type: "uint256" },
					{ name: "price", type: "uint256" },
					{ name: "deadline", type: "uint256" }
				]
			};

			// Create listing authorization message
			const message = {
				seller: account,
				tokenId: tokenId,
				price: priceInWei,
				deadline: deadline
			};

			setMintStatus("Please sign the listing message...");

			// Request user to sign the typed data
			const signature = await signer.signTypedData(domain, types, message);

			console.log("User signed listing:", { domain, types, message, signature });

			setMintStatus("Submitting listing...");

			// Create listing via backend API with user signature
			const response = await fetch(`${API_BASE_URL}/create-listing`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					tokenId: tokenId.toString(),
					contractAddress: CROWN_NFT_ADDRESS,
					sellerAddress: account,
					price: priceInWei,
					signature: signature,
					deadline: deadline,
					nonce: Number(nonce)
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create listing');
			}

			const result = await response.json();
			console.log("Listing created:", result);

			setMintStatus(`✅ NFT #${tokenId} listed for sale at ${price} DARK tokens! 🎉`);

			// Reload data to show the listing
			setTimeout(async () => {
				await loadNFTsFromBackend(account);
				setMintStatus("");
			}, 3000);

		} catch (err) {
			console.error("Listing failed:", err);
			if (err instanceof Error && err.message.includes("user rejected")) {
				setMintStatus("❌ Listing cancelled by user");
			} else {
				setMintStatus(`❌ Listing failed: ${err instanceof Error ? err.message : "Unknown error"}`);
			}
			setTimeout(() => setMintStatus(""), 5000);
		}
	};

	const purchaseNFT = async (tokenId: number) => {
		if (!account) {
			alert("Please connect your wallet first");
			return;
		}

		try {
			console.log(`Starting purchase of CrownNFT #${tokenId}`);
			setMintStatus(`Preparing to purchase NFT #${tokenId}...`);

			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();

			// Find the NFT owner from allNFTs
			const nft = allNFTs.find(n => n.tokenId === tokenId);
			if (!nft) {
				throw new Error("NFT not found");
			}

			if (nft.owner.toLowerCase() === account.toLowerCase()) {
				throw new Error("You already own this NFT");
			}

			// Get listing data and signature from backend
			setMintStatus("Getting listing data...");
			const signatureResponse = await fetch(`${API_BASE_URL}/get-listing-signature`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					tokenId: tokenId,
					contractAddress: CROWN_NFT_ADDRESS,
					buyerAddress: account
				})
			});

			if (!signatureResponse.ok) {
				const errorData = await signatureResponse.json();
				throw new Error(`No active listing found: ${errorData.error}`);
			}

			const signatureData = await signatureResponse.json();

			console.log("Found listing with signature:", signatureData);

			// Use the listing price
			const priceInWei = signatureData.transferData.price;
			const priceInDark = ethers.formatUnits(priceInWei, 18);

			// Create DARK token contract instance
			const darkContract = new ethers.Contract(DARK_TOKEN_ADDRESS, DarkToken.abi, signer);

			// Check buyer's DARK token balance
			setMintStatus("Checking DARK balance...");
			const balance = await darkContract.balanceOf(account);
			console.log(`Buyer balance: ${ethers.formatUnits(balance, 18)} DARK`);

			if (balance < BigInt(priceInWei)) {
				throw new Error(`Insufficient DARK tokens. Need ${priceInDark} DARK, have ${ethers.formatUnits(balance, 18)} DARK`);
			}

			// Check allowance for CrownPurchase contract
			setMintStatus("Checking token approval...");
			const allowance = await darkContract.allowance(account, CROWN_PURCHASE_ADDRESS);
			console.log(`Current allowance: ${ethers.formatUnits(allowance, 18)} DARK`);

			if (allowance < BigInt(priceInWei)) {
				setMintStatus("Approving DARK tokens for purchase...");
				// Reset allowance to 0 first if there's existing allowance
				if (allowance > 0n) {
					const txReset = await darkContract.approve(CROWN_PURCHASE_ADDRESS, 0);
					console.log("Reset approval transaction sent:", txReset.hash);
					await txReset.wait();
					console.log("Allowance reset to 0");
				}

				// Now approve the full price amount
				const txApprove = await darkContract.approve(CROWN_PURCHASE_ADDRESS, priceInWei);
				console.log("Approval transaction sent:", txApprove.hash);
				await txApprove.wait();
				console.log("Approval confirmed");
			}
			setMintStatus("Executing transfer...");

			// Call the CrownPurchase contract's transferWithSignature function
			const purchaseContractForTransfer = new ethers.Contract(CROWN_PURCHASE_ADDRESS, [
				"function transferWithSignature(address from, address to, uint256 tokenId, uint256 price, uint256 deadline, uint256 nonce, bytes memory signature) external payable"
			], signer);

			const tx = await purchaseContractForTransfer.transferWithSignature(
				signatureData.transferData.from,
				signatureData.transferData.to,
				signatureData.transferData.tokenId,
				signatureData.transferData.price,
				signatureData.transferData.deadline,
				signatureData.transferData.nonce,
				signatureData.signature
			);

			setMintStatus("Confirming transfer...");
			console.log("Transfer transaction sent:", tx.hash);

			const receipt = await tx.wait();
			console.log("Transfer confirmed:", receipt);

			setMintStatus(`✅ NFT #${tokenId} purchased successfully! 🎉`);

			// Reload data after successful transfer
			setTimeout(async () => {
				await loadNFTsFromBackend(account);
				setMintStatus("");
			}, 3000);

		} catch (err) {
			console.error("Purchase failed:", err);
			setMintStatus(`❌ Purchase failed: ${err instanceof Error ? err.message : "Unknown error"}`);
			setTimeout(() => setMintStatus(""), 5000);
		}
	};

	return (
		<div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
			<div style={{ textAlign: 'center', marginBottom: '30px' }}>
				<h1 style={{ color: '#333', marginBottom: '10px' }}>CrownNFT Marketplace</h1>
				<p style={{ color: '#666', marginBottom: '20px' }}>Mint, trade, and collect unique CrownNFTs with DARK tokens</p>

				<div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
					{!account ? (
						<button
							onClick={connectWallet}
							style={{
								backgroundColor: '#4CAF50',
								color: 'white',
								border: 'none',
								padding: '12px 24px',
								borderRadius: '8px',
								fontSize: '16px',
								cursor: 'pointer',
								boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
							}}
						>
							Connect Wallet
						</button>
					) : (
						<>
							<div style={{
								color: '#4CAF50',
								fontWeight: 'bold',
								padding: '12px 24px',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: '5px'
							}}>
								<span>Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}</span>
								<span style={{ fontSize: '14px', color: '#666' }}>
									Balance: {parseFloat(darkBalance).toFixed(2)} DARK
								</span>
							</div>
							<button
								onClick={mintNFT}
								disabled={mintStatus.includes("...")}
								style={{
									backgroundColor: mintStatus.includes("...") ? '#ccc' : '#4CAF50',
									color: 'white',
									border: 'none',
									padding: '12px 24px',
									borderRadius: '8px',
									fontSize: '16px',
									cursor: mintStatus.includes("...") ? 'not-allowed' : 'pointer',
									boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
								}}
							>
								{mintStatus.includes("...") ? mintStatus : `Mint CrownNFT (${nftPrice} DARK)`}
							</button>
							{safeAddress && (
								<button
									onClick={safeMintNFT}
									disabled={mintStatus.includes("...")}
									style={{
										backgroundColor: mintStatus.includes("...") ? '#ccc' : '#2196F3',
										color: 'white',
										border: 'none',
										padding: '12px 24px',
										borderRadius: '8px',
										fontSize: '16px',
										cursor: mintStatus.includes("...") ? 'not-allowed' : 'pointer',
										boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
									}}
								>
									Mint via Safe Wallet
								</button>
							)}
							<button
								onClick={syncDatabase}
								disabled={mintStatus.includes("...")}
								style={{
									backgroundColor: mintStatus.includes("...") ? '#ccc' : '#ff9800',
									color: 'white',
									border: 'none',
									padding: '12px 24px',
									borderRadius: '8px',
									fontSize: '16px',
									cursor: mintStatus.includes("...") ? 'not-allowed' : 'pointer',
									boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
								}}
							>
								Sync DB
							</button>
							<button
								onClick={debugDatabase}
								style={{
									backgroundColor: '#9c27b0',
									color: 'white',
									border: 'none',
									padding: '12px 24px',
									borderRadius: '8px',
									fontSize: '16px',
									cursor: 'pointer',
									boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
								}}
							>
								Debug DB
							</button>
						</>
					)}
				</div>

				{mintStatus && !mintStatus.includes("...") && (
					<div style={{
						marginTop: '10px',
						padding: '10px',
						borderRadius: '5px',
						backgroundColor: mintStatus.includes("Successfully") || mintStatus.includes("✅") ? '#d4edda' : '#f8d7da',
						color: mintStatus.includes("Successfully") || mintStatus.includes("✅") ? '#155724' : '#721c24',
						border: `1px solid ${mintStatus.includes("Successfully") || mintStatus.includes("✅") ? '#c3e6cb' : '#f5c6cb'}`
					}}>
						{mintStatus}
					</div>
				)}
			</div>

			{/* Tab Navigation */}
			<div style={{
				display: 'flex',
				marginBottom: '30px',
				borderBottom: '2px solid #eee'
			}}>
				<button
					onClick={() => setActiveTab('my-nfts')}
					style={{
						backgroundColor: activeTab === 'my-nfts' ? '#4CAF50' : 'transparent',
						color: activeTab === 'my-nfts' ? 'white' : '#666',
						border: 'none',
						padding: '15px 30px',
						fontSize: '16px',
						cursor: 'pointer',
						borderRadius: '8px 8px 0 0',
						marginRight: '5px',
						transition: 'all 0.3s ease'
					}}
				>
					My CrownNFTs ({myNFTs.length})
				</button>
				<button
					onClick={() => setActiveTab('all-nfts')}
					style={{
						backgroundColor: activeTab === 'all-nfts' ? '#4CAF50' : 'transparent',
						color: activeTab === 'all-nfts' ? 'white' : '#666',
						border: 'none',
						padding: '15px 30px',
						fontSize: '16px',
						cursor: 'pointer',
						borderRadius: '8px 8px 0 0',
						transition: 'all 0.3s ease'
					}}
				>
					All CrownNFTs ({allNFTs.length})
				</button>
			</div>

			{/* Tab Content */}
			{activeTab === 'my-nfts' && (
				<div>
					<h2 style={{ marginBottom: '20px', color: '#333' }}>My CrownNFT Collection</h2>
					{myNFTs.length > 0 ? (
						<div style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
							gap: '20px'
						}}>
							{myNFTs.map((nft) => (
								<div key={nft.tokenId} style={{
									backgroundColor: 'white',
									borderRadius: '12px',
									padding: '20px',
									boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
									border: '1px solid #e0e0e0',
									transition: 'transform 0.2s ease, box-shadow 0.2s ease'
								}}>
									<div style={{
										width: '100%',
										height: '200px',
										backgroundColor: '#f0f0f0',
										borderRadius: '8px',
										marginBottom: '15px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										color: '#666'
									}}>
										👑 CrownNFT #{nft.tokenId}
									</div>

									<div style={{ marginBottom: '15px' }}>
										<h3 style={{ margin: '0 0 5px 0', color: '#333' }}>
											CrownNFT #{nft.tokenId}
										</h3>
										<p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
											Owner: {nft.owner.substring(0, 6)}...{nft.owner.substring(nft.owner.length - 4)}
										</p>
									</div>

									<button
										onClick={() => listNFTForResale(nft.tokenId)}
										style={{
											width: '100%',
											backgroundColor: '#4CAF50',
											color: 'white',
											border: 'none',
											padding: '12px',
											borderRadius: '6px',
											fontSize: '14px',
											cursor: 'pointer',
											transition: 'background-color 0.2s ease'
										}}
									>
										List for Sale
									</button>
								</div>
							))}
						</div>
					) : (
						<div style={{
							textAlign: 'center',
							padding: '60px 20px',
							color: '#666'
						}}>
							<h3>No CrownNFTs Found</h3>
							<p>You don't own any CrownNFTs yet. Mint your first CrownNFT to get started!</p>
						</div>
					)}
				</div>
			)}

			{activeTab === 'all-nfts' && (
				<div>
					<h2 style={{ marginBottom: '20px', color: '#333' }}>CrownNFT Marketplace</h2>
					<div style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
						gap: '20px'
					}}>
						{allNFTs.map((nft) => {
							const isOwner = account && nft.owner.toLowerCase() === account.toLowerCase();

							return (
								<div key={nft.tokenId} style={{
									backgroundColor: 'white',
									borderRadius: '12px',
									padding: '20px',
									boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
									border: '1px solid #e0e0e0',
									transition: 'transform 0.2s ease, box-shadow 0.2s ease',
									position: 'relative'
								}}>
									{isOwner && (
										<div style={{
											position: 'absolute',
											top: '10px',
											right: '10px',
											backgroundColor: '#4CAF50',
											color: 'white',
											padding: '4px 8px',
											borderRadius: '12px',
											fontSize: '12px',
											fontWeight: 'bold'
										}}>
											Yours
										</div>
									)}

									<div style={{
										width: '100%',
										height: '200px',
										backgroundColor: '#f0f0f0',
										borderRadius: '8px',
										marginBottom: '15px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										color: '#666'
									}}>
										👑 CrownNFT #{nft.tokenId}
									</div>

									<div style={{ marginBottom: '15px' }}>
										<h3 style={{ margin: '0 0 5px 0', color: '#333' }}>
											CrownNFT #{nft.tokenId}
										</h3>
										<p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
											Owner: {nft.owner.substring(0, 6)}...{nft.owner.substring(nft.owner.length - 4)}
										</p>
										{nft.is_listed && nft.listing_price && (
											<p style={{ margin: '5px 0 0 0', color: '#4CAF50', fontSize: '14px', fontWeight: 'bold' }}>
												Listed for: {parseFloat(ethers.formatUnits(nft.listing_price, 18)).toFixed(2)} DARK
											</p>
										)}
									</div>

									{isOwner ? (
										nft.is_listed ? (
											<button
												style={{
													width: '100%',
													backgroundColor: '#ff9800',
													color: 'white',
													border: 'none',
													padding: '12px',
													borderRadius: '6px',
													fontSize: '14px',
													cursor: 'not-allowed'
												}}
											>
												Listed for Sale
											</button>
										) : (
											<button
												onClick={() => listNFTForResale(nft.tokenId)}
												style={{
													width: '100%',
													backgroundColor: '#4CAF50',
													color: 'white',
													border: 'none',
													padding: '12px',
													borderRadius: '6px',
													fontSize: '14px',
													cursor: 'pointer',
													transition: 'background-color 0.2s ease'
												}}
											>
												List for Sale
											</button>
										)
									) : account ? (
										nft.is_listed ? (
											<button
												onClick={() => purchaseNFT(nft.tokenId)}
												style={{
													width: '100%',
													backgroundColor: '#2196F3',
													color: 'white',
													border: 'none',
													padding: '12px',
													borderRadius: '6px',
													fontSize: '14px',
													cursor: 'pointer',
													transition: 'background-color 0.2s ease'
												}}
											>
												Buy for {parseFloat(ethers.formatUnits(nft.listing_price || "0", 18)).toFixed(2)} DARK
											</button>
										) : (
											<button
												style={{
													width: '100%',
													backgroundColor: '#ccc',
													color: '#666',
													border: 'none',
													padding: '12px',
													borderRadius: '6px',
													fontSize: '14px',
													cursor: 'not-allowed'
												}}
											>
												Not for Sale
											</button>
										)
									) : (
										<button
											onClick={() => alert('Please connect your wallet to purchase')}
											style={{
												width: '100%',
												backgroundColor: '#ccc',
												color: '#666',
												border: 'none',
												padding: '12px',
												borderRadius: '6px',
												fontSize: '14px',
												cursor: 'not-allowed'
											}}
										>
											Connect Wallet to Purchase
										</button>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
