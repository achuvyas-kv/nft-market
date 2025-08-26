
import './App.css';
import { useState } from 'react';
import { ethers } from 'ethers';
import CrownNFTSimple from "../../artifacts/contracts/CrownNFTSimple.sol/CrownNFTSimple.json";
import CrownPurchase from "../../artifacts/contracts/CrownPurchase.sol/CrownPurchase.json";
import DarkToken from "../../artifacts/contracts/DarkToken.sol/DarkToken.json";
// import SignatureCounter from "../../artifacts/contracts/SignatureCounter.sol/SignatureCounter.json"; // Will be available after compilation

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

// Deployed contract addresses (V6 buyer-agnostic EIP-712)
const CROWN_NFT_ADDRESS = "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6";
const CROWN_PURCHASE_ADDRESS = "0xB7Aa678187441466e11B2EFCF6a9716AC7Bb840c";
const DARK_TOKEN_ADDRESS = "0x4d4C324C3a408476e25887025dDbA50839ECd7B1";
const SIGNATURE_COUNTER_ADDRESS = "0x13AC5e813795099711d5A1357469BDb12B761656"; // SignatureCounter deployed on Sepolia

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
	const [activeTab, setActiveTab] = useState<'my-nfts' | 'all-nfts' | 'counter'>('my-nfts');
	const [account, setAccount] = useState("");
	const [mintStatus, setMintStatus] = useState("");
	const [myNFTs, setMyNFTs] = useState<NFT[]>([]);
	const [allNFTs, setAllNFTs] = useState<NFT[]>([]);
	const [darkBalance, setDarkBalance] = useState("");
	const [nftPrice, setNftPrice] = useState("");
	const [safeAddress, setSafeAddress] = useState("");

	// Counter state
	const [currentCount, setCurrentCount] = useState(0);
	const [newCountValue, setNewCountValue] = useState("");
	const [signature, setSignature] = useState("");
	const [nonce, setNonce] = useState("");
	const [counterStatus, setCounterStatus] = useState("");

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



	async function checkSmartWallet(walletAddress: string) {
		try {
			console.log(`🔍 Checking Safe wallets for address: ${walletAddress}`);

			// Check the Safe API for wallets owned by this address
			const apiUrl = "https://safe-transaction-sepolia.safe.global";
			const res = await fetch(`${apiUrl}/api/v1/owners/${walletAddress}/safes/`);

			if (res.ok) {
				const data = await res.json();
				console.log("Safe API response:", data);

				if (data.safes && data.safes.length > 0) {
					// Log all found Safes
					console.log(`✅ Found ${data.safes.length} Safe wallet(s) for ${walletAddress}:`);
					data.safes.forEach((safe: string, index: number) => {
						console.log(`  ${index + 1}. ${safe}`);
					});

					// Use the first Safe found
					const firstSafe = data.safes[0];
					console.log(`🎯 Using Safe wallet: ${firstSafe}`);
					setSafeAddress(firstSafe);
					setMintStatus(`✅ Safe wallet detected: ${firstSafe.substring(0, 6)}...${firstSafe.substring(firstSafe.length - 4)}`);
					setTimeout(() => setMintStatus(""), 3000);
				} else {
					console.log(`❌ No Safe wallets found for address: ${walletAddress}`);
					setSafeAddress("");
					setMintStatus("ℹ️ No Safe wallet found. Safe wallet required for purchases.");
					setTimeout(() => setMintStatus(""), 5000);
				}
			} else {
				console.log(`❌ Failed to fetch Safe wallets from API. Status: ${res.status}`);
				setSafeAddress("");
				setMintStatus("⚠️ Failed to check for Safe wallets");
				setTimeout(() => setMintStatus(""), 3000);
			}
		} catch (e) {
			console.log("❌ Error checking Safe wallets:", e);
			setSafeAddress("");
			setMintStatus("⚠️ Error checking for Safe wallets");
			setTimeout(() => setMintStatus(""), 3000);
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
			console.log(`📡 Fetching NFTs for owner: ${userAddress}`);
			const userNFTsResponse = await fetch(`${API_BASE_URL}/nfts?owner=${userAddress}`);
			if (userNFTsResponse.ok) {
				const userNFTsData = await userNFTsResponse.json();
				console.log(`📦 Raw user NFT data:`, userNFTsData);
				const userNFTs: NFT[] = userNFTsData.map((nft: any) => ({
					tokenId: parseInt(nft.token_id),
					owner: userAddress,
					metadata: nft.metadata_uri || `https://example.com/metadata/${nft.token_id}`
				}));
				setMyNFTs(userNFTs);
				console.log(`✅ Loaded ${userNFTs.length} user NFTs from backend for ${userAddress}`);
			} else {
				console.error(`❌ Failed to load user NFTs from backend for ${userAddress}`);
				setMyNFTs([]);
			}

			// Load all NFTs from backend
			console.log(`📡 Fetching all NFTs from backend`);
			const allNFTsResponse = await fetch(`${API_BASE_URL}/all-nfts`);
			if (allNFTsResponse.ok) {
				const allNFTsData = await allNFTsResponse.json();
				console.log(`📦 Raw all NFTs data:`, allNFTsData);
				const allNFTs: NFT[] = allNFTsData.map((nft: any) => ({
					tokenId: parseInt(nft.token_id),
					owner: nft.owner_address,
					metadata: nft.metadata_uri || `https://example.com/metadata/${nft.token_id}`,
					listing_price: nft.listing_price,
					is_listed: !!nft.is_listed,
					listing_deadline: nft.listing_deadline
				}));
				setAllNFTs(allNFTs);
				console.log(`✅ Loaded ${allNFTs.length} total NFTs from backend`);
				allNFTs.forEach((nft, index) => {
					console.log(`  ${index + 1}. NFT #${nft.tokenId} owned by ${nft.owner}`);
				});
			} else {
				console.error("❌ Failed to load all NFTs from backend");
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

			setMintStatus(`✅ Minted! Tx: ${tx.hash.slice(0, 10)}... View: https://sepolia.etherscan.io/tx/${tx.hash}`);
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

			setMintStatus("Preparing Safe mint...");

			const accounts = await window.ethereum.request({
				method: 'eth_requestAccounts'
			});
			const signerAddress = accounts[0];

			// Connect to an existing Safe  
			const protocolKit = await Safe.init({
				provider: window.ethereum,
				signer: signerAddress,
				safeAddress: safeAddress
			});

			// Get the SafeProvider instance  
			const safeProvider = protocolKit.getSafeProvider();
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

			// Check Safe's DARK token balance
			setMintStatus("Checking Safe's DARK balance...");
			const balance = await darkContract.balanceOf(safeAddress);
			console.log(`Safe balance: ${ethers.formatUnits(balance, 18)} DARK`);

			// if (balance < price) {
			// 	throw new Error(`Insufficient DARK tokens in Safe. Need ${ethers.formatUnits(price, 18)} DARK, have ${ethers.formatUnits(balance, 18)} DARK`);
			// }

			// Read allowance using SafeProvider.call()
			setMintStatus("Checking token approval...");
			const allowanceCallData = darkContract.interface.encodeFunctionData('allowance', [
				safeAddress, // Use Safe address instead of EOA account  
				CROWN_PURCHASE_ADDRESS
			]);

			const allowanceResult = await safeProvider.call({
				from: safeAddress,
				to: DARK_TOKEN_ADDRESS,
				data: allowanceCallData
			});

			// Decode the allowance result
			const allowance = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], allowanceResult)[0];
			console.log(`Current allowance: ${ethers.formatUnits(allowance, 18)} DARK`);

			// Create transactions array - approval first if needed, then mint
			const transactions = [];

			if (allowance < price) {
				setMintStatus("Creating approval transaction...");

				// Create the approval transaction data  
				const approvalTransaction = {
					to: DARK_TOKEN_ADDRESS,
					value: '0',
					data: darkContract.interface.encodeFunctionData('approve', [
						CROWN_PURCHASE_ADDRESS,
						price
					])
				};
				transactions.push(approvalTransaction);
				console.log("Added approval transaction to batch");
			}

			// Create mint transaction
			setMintStatus("Creating mint transaction...");
			const metadataURI = "https://gist.githubusercontent.com/achuvyas-kv/64144080cc11ab0c49e40afdd8d0b0e9/raw/e9e2a9aaafcebd358d9cd7390e37620732a6f230/metadata.json";
			const mintTransaction = {
				to: CROWN_PURCHASE_ADDRESS,
				value: '0',
				data: purchaseContract.interface.encodeFunctionData('buyNFT', [metadataURI])
			};
			transactions.push(mintTransaction);
			console.log("Added mint transaction to batch");

			// Create Safe transaction with all operations
			setMintStatus("Creating Safe transaction...");
			const safeTransaction = await protocolKit.createTransaction({
				transactions: transactions
			});

			// Sign the transaction  
			setMintStatus("Please sign the transaction...");
			const signedTransaction = await protocolKit.signTransaction(safeTransaction);

			// Execute the transaction  
			setMintStatus("Executing transaction...");
			const txResponse = await protocolKit.executeTransaction(signedTransaction);
			console.log("Transaction sent:", txResponse.hash);

			setMintStatus("Confirming transaction...");
			// Handle the transaction response properly
			try {
				if (txResponse.transactionResponse) {
					const receipt = await (txResponse.transactionResponse as any).wait();
					console.log("Transaction confirmed:", receipt);
				} else {
					console.log("Transaction executed, hash:", txResponse.hash);
				}
			} catch (waitError) {
				// Fallback if wait method is not available
				console.log("Transaction executed, hash:", txResponse.hash);
			}

			setMintStatus(`✅ Minted via Safe! Tx: ${txResponse.hash.slice(0, 10)}... View: https://sepolia.etherscan.io/tx/${txResponse.hash}`);
			console.log("NFT minted in tx:", txResponse.hash);

			// Reload data from backend
			setTimeout(async () => {
				const provider = new ethers.BrowserProvider(window.ethereum);
				await loadUserData(account, provider);
			}, 2000);

		} catch (err) {
			console.error("Safe mint failed:", err);
			setMintStatus(`❌ Safe minting failed: ${err instanceof Error ? err.message : "Unknown error"}`);
			setTimeout(() => setMintStatus(""), 5000);
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

			const ethProvider = new ethers.BrowserProvider(window.ethereum);
			const ethSigner = await ethProvider.getSigner();
			const nftContract = new ethers.Contract(CROWN_NFT_ADDRESS, CrownNFTSimple.abi, ethSigner);

			// Check if NFT contract is approved for all
			setMintStatus("Checking NFT approval...");
			const isApproved = await nftContract.isApprovedForAll(account, CROWN_PURCHASE_ADDRESS);

			if (!isApproved) {
				setMintStatus("Approving NFT contract for transfers...");
				const approvalTx = await nftContract.setApprovalForAll(CROWN_PURCHASE_ADDRESS, true);
				console.log("NFT approval transaction sent:", approvalTx.hash);
				await approvalTx.wait();
				console.log("NFT approval confirmed");
			}

			// Find the NFT to determine actual owner
			const nft = allNFTs.find(n => n.tokenId === tokenId) || myNFTs.find(n => n.tokenId === tokenId);
			if (!nft) {
				throw new Error("NFT not found");
			}

			// Use the actual owner address (could be MetaMask or Safe)
			const actualOwner = nft.owner;
			console.log(`Listing NFT #${tokenId} owned by: ${actualOwner}`);
			console.log(`Current MetaMask account: ${account}`);
			console.log(`Safe address: ${safeAddress}`);
			console.log(`Is Safe wallet NFT: ${safeAddress && actualOwner.toLowerCase() === safeAddress.toLowerCase()}`);

			// If NFT is owned by a Safe, ensure connected EOA is an owner and handle Safe NFT approval
			if (safeAddress && actualOwner.toLowerCase() === safeAddress.toLowerCase()) {
				try {
					const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
					const signerAddress = accounts[0];
					const protocolKit = await Safe.init({ provider: window.ethereum, signer: signerAddress, safeAddress: safeAddress });
					const owners = await protocolKit.getOwners();
					const isOwner = owners.some(owner => owner.toLowerCase() === signerAddress.toLowerCase());
					if (!isOwner) {
						throw new Error(`Connected account is not an owner of the Safe. Owners: ${owners.join(', ')}`);
					}

					// Check Safe NFT approval
					setMintStatus("Checking Safe NFT approval...");
					const safeNftContract = new ethers.Contract(CROWN_NFT_ADDRESS, CrownNFTSimple.abi, ethProvider);
					const isSafeApproved = await safeNftContract.isApprovedForAll(safeAddress, CROWN_PURCHASE_ADDRESS);

					if (!isSafeApproved) {
						setMintStatus("Approving NFT contract for Safe transfers...");
						const approvalTransaction = {
							to: CROWN_NFT_ADDRESS,
							value: '0',
							data: safeNftContract.interface.encodeFunctionData('setApprovalForAll', [CROWN_PURCHASE_ADDRESS, true])
						};

						const safeTransaction = await protocolKit.createTransaction({ transactions: [approvalTransaction] });
						const signedTransaction = await protocolKit.signTransaction(safeTransaction);
						const txResponse = await protocolKit.executeTransaction(signedTransaction);
						console.log("Safe NFT approval transaction sent:", txResponse.hash);

						if (txResponse.transactionResponse) {
							await (txResponse.transactionResponse as any).wait();
						}
						console.log("Safe NFT approval confirmed");
					}
				} catch (safeErr) {
					console.error("Safe owner check failed:", safeErr);
					alert(`Safe owner check failed: ${safeErr instanceof Error ? safeErr.message : safeErr}`);
					return;
				}
			}

			// Convert price to wei (18 decimals)
			const priceInWei = ethers.parseUnits(price, 18).toString();

			// Get current nonce for the actual owner (the NFT holder)
			const purchaseContract = new ethers.Contract(CROWN_PURCHASE_ADDRESS, CrownPurchase.abi, ethProvider);
			const nonce = await purchaseContract.nonces(actualOwner);

			// Set deadline to 24 hours from now
			const deadline = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

			// Create EIP712 domain and types for Transfer (matching contract expectations)
			const domain = {
				name: "CrownPurchase",
				version: "1",
				chainId: 11155111, // Sepolia
				verifyingContract: CROWN_PURCHASE_ADDRESS
			};

			const types = {
				Transfer: [
					{ name: "from", type: "address" },
					{ name: "tokenId", type: "uint256" },
					{ name: "price", type: "uint256" },
					{ name: "deadline", type: "uint256" },
					{ name: "nonce", type: "uint256" }
				]
			};

			// Create listing data (buyer-agnostic)
			const message = {
				from: actualOwner,
				tokenId: tokenId,
				price: priceInWei,
				deadline: deadline,
				nonce: Number(nonce)
			};

			setMintStatus("Please sign the transfer authorization...");

			let signature: string;

			signature = await ethSigner.signTypedData(domain, types, message);
			console.log("Signed transfer authorization:", { domain, types, message, signature });

			// Local verification to ensure signature matches connected EOA (prevents bad listings)
			try {
				const recovered = ethers.verifyTypedData(domain, types, message, signature);
				if (recovered.toLowerCase() !== account.toLowerCase()) {
					throw new Error(`Signature signer ${recovered} does not match connected account ${account}`);
				}
			} catch (verifyErr) {
				console.error("Local signature verification failed:", verifyErr);
				alert(`Signature verification failed: ${verifyErr instanceof Error ? verifyErr.message : verifyErr}`);
				return;
			}

			setMintStatus("Submitting listing...");

			const requestBody = {
				tokenId: tokenId.toString(),
				contractAddress: CROWN_NFT_ADDRESS,
				sellerAddress: actualOwner,
				price: priceInWei,
				signature: signature,
				deadline: deadline,
				nonce: Number(nonce),
				signerAddress: account,
				isSafeWallet: safeAddress && actualOwner.toLowerCase() === safeAddress.toLowerCase()
			};

			console.log("Sending listing request:", requestBody);

			// Create listing via backend API with user signature
			const response = await fetch(`${API_BASE_URL}/create-listing`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody)
			});

			console.log("Response status:", response.status);

			if (!response.ok) {
				const errorData = await response.json();
				console.log("Error response:", errorData);
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

	// Counter Functions
	const loadCurrentCount = async () => {
		if (!SIGNATURE_COUNTER_ADDRESS) {
			setCounterStatus("❌ SignatureCounter contract not deployed yet");
			return;
		}

		try {
			const provider = new ethers.BrowserProvider(window.ethereum);
			const counterContract = new ethers.Contract(SIGNATURE_COUNTER_ADDRESS, [
				"function getCurrentCount() view returns (uint256)",
				"function updateCountWithSignature(uint256 newCount, uint256 nonce, bytes memory signature) external"
			], provider);
			const count = await counterContract.getCurrentCount();
			setCurrentCount(Number(count));
			console.log("Current count:", Number(count));
		} catch (err) {
			console.error("Failed to load current count:", err);
			setCounterStatus(`❌ Failed to load count: ${err instanceof Error ? err.message : "Unknown error"}`);
		}
	};

	const generateSignature = async () => {
		if (!newCountValue || !nonce) {
			setCounterStatus("❌ Please enter both new count and nonce");
			return;
		}

		try {
			setCounterStatus("Generating signature...");

			const response = await fetch(`${API_BASE_URL}/generate-counter-signature`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contractAddress: SIGNATURE_COUNTER_ADDRESS,
					newCount: parseInt(newCountValue),
					nonce: parseInt(nonce)
				})
			});

			if (!response.ok) {
				throw new Error('Failed to generate signature');
			}

			const result = await response.json();
			setSignature(result.signature);
			setCounterStatus("✅ Signature generated successfully!");

		} catch (err) {
			console.error("Failed to generate signature:", err);
			setCounterStatus(`❌ Failed to generate signature: ${err instanceof Error ? err.message : "Unknown error"}`);
		}
	};

	const updateCountWithSignature = async () => {
		if (!account || !safeAddress) {
			setCounterStatus("❌ Please connect your wallet and Safe first");
			return;
		}

		if (!newCountValue || !nonce || !signature) {
			setCounterStatus("❌ Please fill all fields and generate signature first");
			return;
		}

		if (!SIGNATURE_COUNTER_ADDRESS) {
			setCounterStatus("❌ SignatureCounter contract not deployed yet");
			return;
		}

		try {
			setCounterStatus("Updating count via Safe...");

			const accounts = await window.ethereum.request({
				method: 'eth_requestAccounts'
			});
			const signerAddress = accounts[0];

			// Connect to Safe
			const protocolKit = await Safe.init({
				provider: window.ethereum,
				signer: signerAddress,
				safeAddress: safeAddress
			});

			const provider = new ethers.BrowserProvider(window.ethereum);
			const counterContract = new ethers.Contract(SIGNATURE_COUNTER_ADDRESS, [
				"function getCurrentCount() view returns (uint256)",
				"function updateCountWithSignature(uint256 newCount, uint256 nonce, bytes memory signature) external"
			], provider);

			// Create transaction data
			const txData = counterContract.interface.encodeFunctionData('updateCountWithSignature', [
				parseInt(newCountValue),
				parseInt(nonce),
				signature
			]);

			const safeTransaction = await protocolKit.createTransaction({
				transactions: [{
					to: SIGNATURE_COUNTER_ADDRESS,
					value: '0',
					data: txData
				}]
			});

			// Sign and execute
			setCounterStatus("Please sign the transaction...");
			const signedTransaction = await protocolKit.signTransaction(safeTransaction);

			setCounterStatus("Executing transaction...");
			const txResponse = await protocolKit.executeTransaction(signedTransaction);

			console.log("Counter update transaction sent:", txResponse.hash);

			setCounterStatus(`✅ Count updated! Tx: ${txResponse.hash.slice(0, 10)}... View: https://sepolia.etherscan.io/tx/${txResponse.hash}`);

			// Reload current count
			setTimeout(() => {
				loadCurrentCount();
				setNewCountValue("");
				setNonce("");
				setSignature("");
			}, 3000);

		} catch (err) {
			console.error("Update count failed:", err);
			setCounterStatus(`❌ Update failed: ${err instanceof Error ? err.message : "Unknown error"}`);
		}
	};

	const purchaseNFT = async (tokenId: number) => {
		if (!account) {
			alert("Please connect your wallet first");
			return;
		}

		try {
			setMintStatus(`Preparing to purchase NFT #${tokenId}...`);

			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();
			const buyerAddress = await signer.getAddress();

			// Get listing data and stored signature from backend
			setMintStatus("Getting listing data...");
			const signatureResponse = await fetch(`${API_BASE_URL}/get-listing-signature`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tokenId,
					contractAddress: CROWN_NFT_ADDRESS,
					buyerAddress: buyerAddress
				})
			});

			if (!signatureResponse.ok) {
				const err = await signatureResponse.json();
				throw new Error(err.error || 'No active listing found');
			}

			const signatureData = await signatureResponse.json();
			const priceInWei = signatureData.transferData.price as string;

			// Contracts
			const darkContract = new ethers.Contract(DARK_TOKEN_ADDRESS, DarkToken.abi, signer);
			const purchaseContract = new ethers.Contract(CROWN_PURCHASE_ADDRESS, CrownPurchase.abi, signer);

			// Ensure allowance
			setMintStatus("Checking token approval...");
			const currentAllowance = await darkContract.allowance(buyerAddress, CROWN_PURCHASE_ADDRESS);
			if (currentAllowance < BigInt(priceInWei)) {
				setMintStatus("Approving DARK tokens...");
				const txApprove = await darkContract.approve(CROWN_PURCHASE_ADDRESS, priceInWei);
				await txApprove.wait();
			}

			// Execute purchase
			setMintStatus("Executing purchase...");
			const tx = await purchaseContract.transferWithSignature(
				signatureData.transferData.from,
				buyerAddress,
				signatureData.transferData.tokenId,
				priceInWei,
				signatureData.transferData.deadline,
				signatureData.transferData.nonce,
				signatureData.signature
			);
			await tx.wait();

			setMintStatus(`✅ Purchased! Tx: ${tx.hash.slice(0, 10)}... View: https://sepolia.etherscan.io/tx/${tx.hash}`);

			// Reload data after successful transfer
			setTimeout(async () => {
				await loadNFTsFromBackend(buyerAddress);
				setMintStatus("");
			}, 3000);

		} catch (err) {
			console.error("Purchase failed:", err);
			setMintStatus(`❌ Purchase failed: ${err instanceof Error ? err.message : "Unknown error"}`);
			setTimeout(() => setMintStatus(""), 5000);
		}
	};

	// const purchaseNFT = async (tokenId: number) => {
	// 	if (!account) {
	// 		alert("Please connect your wallet first");
	// 		return;
	// 	}
	//
	// 	try {
	// 		console.log(`Starting purchase of CrownNFT #${tokenId}`);
	// 		setMintStatus(`Preparing to purchase NFT #${tokenId}...`);
	//
	// 		const provider = new ethers.BrowserProvider(window.ethereum);
	// 		const signer = await provider.getSigner();
	//
	// 		// Find the NFT owner from allNFTs
	// 		const nft = allNFTs.find(n => n.tokenId === tokenId);
	// 		if (!nft) {
	// 			throw new Error("NFT not found");
	// 		}
	//
	// 		if (nft.owner.toLowerCase() === account.toLowerCase() || 
	// 			(safeAddress && nft.owner.toLowerCase() === safeAddress.toLowerCase())) {
	// 			throw new Error("You already own this NFT");
	// 		}
	//
	// 		// Get listing data and signature from backend
	// 		setMintStatus("Getting listing data...");
	// 		const signatureResponse = await fetch(`${API_BASE_URL}/get-listing-signature`, {
	// 			method: 'POST',
	// 			headers: {
	// 				'Content-Type': 'application/json',
	// 			},
	// 			body: JSON.stringify({
	// 				tokenId: tokenId,
	// 				contractAddress: CROWN_NFT_ADDRESS,
	// 				buyerAddress: account,
	// 				sellerAddress: nft.owner // Pass the actual NFT owner address (could be Safe)
	// 			})
	// 		});
	//
	// 		if (!signatureResponse.ok) {
	// 			const errorData = await signatureResponse.json();
	// 			throw new Error(`No active listing found: ${errorData.error}`);
	// 		}
	//
	// 		const signatureData = await signatureResponse.json();
	//
	// 		console.log("Found listing with signature:", signatureData);
	//
	// 		// Use the listing price
	// 		const priceInWei = signatureData.transferData.price;
	// 		const priceInDark = ethers.formatUnits(priceInWei, 18);
	//
	// 		// Create DARK token contract instance
	// 		const darkContract = new ethers.Contract(DARK_TOKEN_ADDRESS, DarkToken.abi, signer);
	//
	// 		// Always use Safe wallet for purchases if available
	// 		const buyerIsSafe = !!safeAddress;
	// 		const buyerAddress = buyerIsSafe ? safeAddress : account;
	//
	// 		console.log(`Buyer detection: safeAddress=${safeAddress}, account=${account}, buyerIsSafe=${buyerIsSafe}`);
	// 		console.log(`Current Safe address in state: ${safeAddress}`);
	// 		console.log(`Expected Safe address: 0x0848a2cF7f15766788e04Eb47a50ce33eB37fc1a`);
	//
	// 		// Check buyer's DARK token balance
	// 		setMintStatus("Checking DARK balance...");
	// 		const balance = await darkContract.balanceOf(buyerAddress);
	// 		console.log(`Buyer balance: ${ethers.formatUnits(balance, 18)} DARK`);
	//
	// 		if (balance < BigInt(priceInWei)) {
	// 			throw new Error(`Insufficient DARK tokens. Need ${priceInDark} DARK, have ${ethers.formatUnits(balance, 18)} DARK`);
	// 		}
	//
	// 		// Check Safe's ETH balance for gas if using Safe
	// 		if (buyerIsSafe) {
	// 			const ethBalance = await provider.getBalance(safeAddress);
	// 			console.log(`Safe ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
	// 			if (ethBalance < ethers.parseEther("0.001")) {
	// 				throw new Error(`Insufficient ETH for gas fees. Safe needs at least 0.001 ETH, has ${ethers.formatEther(ethBalance)} ETH`);
	// 			}
	// 		}
	//
	// 		// Check allowance for CrownPurchase contract
	// 		setMintStatus("Checking token approval...");
	// 		const allowance = await darkContract.allowance(buyerAddress, CROWN_PURCHASE_ADDRESS);
	// 		console.log(`Current allowance: ${ethers.formatUnits(allowance, 18)} DARK`);
	//
	// 		if (allowance < BigInt(priceInWei)) {
	// 			setMintStatus("Approving DARK tokens for purchase...");
	//
	// 			if (buyerIsSafe) {
	// 				// Handle Safe wallet approval
	// 				console.log("Creating approval transactions for Safe wallet...");
	//
	// 				const approvalTransactions = [];
	//
	// 				// Reset allowance to 0 first if there's existing allowance
	// 				if (allowance > 0n) {
	// 					approvalTransactions.push({
	// 						to: DARK_TOKEN_ADDRESS,
	// 						value: '0',
	// 						data: darkContract.interface.encodeFunctionData('approve', [CROWN_PURCHASE_ADDRESS, 0])
	// 					});
	// 				}
	//
	// 				// Approve the full price amount
	// 				approvalTransactions.push({
	// 					to: DARK_TOKEN_ADDRESS,
	// 					value: '0',
	// 					data: darkContract.interface.encodeFunctionData('approve', [CROWN_PURCHASE_ADDRESS, priceInWei])
	// 				});
	//
	// 				const accounts = await window.ethereum.request({
	// 					method: 'eth_requestAccounts'
	// 				});
	// 				const signerAddress = accounts[0];
	//
	// 				// Connect to Safe
	// 				const protocolKit = await Safe.init({
	// 					provider: window.ethereum,
	// 					signer: signerAddress,
	// 					safeAddress: safeAddress
	// 				});
	//
	// 				// Execute approval transactions
	// 				const approvalSafeTransaction = await protocolKit.createTransaction({
	// 					transactions: approvalTransactions
	// 				});
	//
	// 				const signedApprovalTransaction = await protocolKit.signTransaction(approvalSafeTransaction);
	// 				const approvalTxResponse = await protocolKit.executeTransaction(signedApprovalTransaction);
	//
	// 				console.log("Safe approval transaction sent:", approvalTxResponse.hash);
	//
	// 				if (approvalTxResponse.transactionResponse) {
	// 					await (approvalTxResponse.transactionResponse as any).wait();
	// 				}
	// 			} else {
	// 				// Handle regular wallet approval
	// 				// Reset allowance to 0 first if there's existing allowance
	// 				if (allowance > 0n) {
	// 					const txReset = await darkContract.approve(CROWN_PURCHASE_ADDRESS, 0);
	// 					console.log("Reset approval transaction sent:", txReset.hash);
	// 					await txReset.wait();
	// 					console.log("Allowance reset to 0");
	// 				}
	//
	// 				// Now approve the full price amount
	// 				const txApprove = await darkContract.approve(CROWN_PURCHASE_ADDRESS, priceInWei);
	// 				console.log("Approval transaction sent:", txApprove.hash);
	// 				await txApprove.wait();
	// 				console.log("Approval confirmed");
	// 			}
	// 		}
	// 		setMintStatus("Executing transfer...");
	//
	// 		if (buyerIsSafe) {
	// 			// Buyer is using Safe wallet - execute through Safe
	// 			console.log("Executing purchase through Safe wallet...");
	//
	// 			const accounts = await window.ethereum.request({
	// 				method: 'eth_requestAccounts'
	// 			});
	// 			const signerAddress = accounts[0];
	//
	// 			// Connect to Safe
	// 			const protocolKit = await Safe.init({
	// 				provider: window.ethereum,
	// 				signer: signerAddress,
	// 				safeAddress: safeAddress
	// 			});
	//
	// 			// Create transaction data for transferWithSignature
	// 			const purchaseContract = new ethers.Contract(CROWN_PURCHASE_ADDRESS, CrownPurchase.abi, signer);
	//
	// 			console.log("Creating transferWithSignature call data...");
	// 			console.log("Transfer params:", {
	// 				from: signatureData.transferData.from,
	// 				to: buyerAddress,
	// 				tokenId: signatureData.transferData.tokenId,
	// 				price: signatureData.transferData.price,
	// 				deadline: signatureData.transferData.deadline,
	// 				nonce: signatureData.transferData.nonce,
	// 				signatureLength: signatureData.signature.length
	// 			});
	//
	// 			const txData = purchaseContract.interface.encodeFunctionData('transferWithSignature', [
	// 				signatureData.transferData.from,
	// 				buyerAddress, // Use the actual buyer address (Safe wallet)
	// 				signatureData.transferData.tokenId,
	// 				signatureData.transferData.price,
	// 				signatureData.transferData.deadline,
	// 				signatureData.transferData.nonce,
	// 				signatureData.signature
	// 			]);
	//
	// 			console.log("Encoded transaction data length:", txData.length);
	// 			console.log("Creating Safe transaction...");
	//
	// 			const safeTransaction = await protocolKit.createTransaction({
	// 				transactions: [{
	// 					to: CROWN_PURCHASE_ADDRESS,
	// 					value: '0',
	// 					data: txData
	// 				}]
	// 			});
	//
	// 			console.log("Safe transaction created:", {
	// 				to: CROWN_PURCHASE_ADDRESS,
	// 				dataLength: txData.length,
	// 				value: '0'
	// 			});
	//
	// 			// Sign and execute through Safe
	// 			const signedTransaction = await protocolKit.signTransaction(safeTransaction);
	// 			const txResponse = await protocolKit.executeTransaction(signedTransaction);
	//
	// 			console.log("Safe transaction sent:", txResponse.hash);
	//
	// 			// Handle response
	// 			if (txResponse.transactionResponse) {
	// 				await (txResponse.transactionResponse as any).wait();
	// 			}
	// 		} else {
	// 			// Regular wallet purchase
	// 			console.log("Executing purchase through regular wallet...");
	//
	// 			const purchaseContractForTransfer = new ethers.Contract(CROWN_PURCHASE_ADDRESS, [
	// 				"function transferWithSignature(address from, address to, uint256 tokenId, uint256 price, uint256 deadline, uint256 nonce, bytes memory signature) external payable"
	// 			], signer);
	//
	// 			const tx = await purchaseContractForTransfer.transferWithSignature(
	// 				signatureData.transferData.from,
	// 				buyerAddress, // Use the actual buyer address
	// 				signatureData.transferData.tokenId,
	// 				signatureData.transferData.price,
	// 				signatureData.transferData.deadline,
	// 				signatureData.transferData.nonce,
	// 				signatureData.signature
	// 			);
	//
	// 			setMintStatus("Confirming transfer...");
	// 			const receipt = await tx.wait();
	// 			console.log("Transfer confirmed:", receipt);
	// 		}
	//
	// 		setMintStatus(`✅ NFT #${tokenId} purchased successfully! 🎉`);
	//
	// 		// Reload data after successful transfer
	// 		setTimeout(async () => {
	// 			await loadNFTsFromBackend(account);
	// 			setMintStatus("");
	// 		}, 3000);
	//
	// 	} catch (err) {
	// 		console.error("Purchase failed:", err);
	// 		setMintStatus(`❌ Purchase failed: ${err instanceof Error ? err.message : "Unknown error"}`);
	// 		setTimeout(() => setMintStatus(""), 5000);
	// 	}
	// };
	//
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
						marginRight: '5px',
						transition: 'all 0.3s ease'
					}}
				>
					All CrownNFTs ({allNFTs.length})
				</button>
				<button
					onClick={() => setActiveTab('counter')}
					style={{
						backgroundColor: activeTab === 'counter' ? '#4CAF50' : 'transparent',
						color: activeTab === 'counter' ? 'white' : '#666',
						border: 'none',
						padding: '15px 30px',
						fontSize: '16px',
						cursor: 'pointer',
						borderRadius: '8px 8px 0 0',
						transition: 'all 0.3s ease'
					}}
				>
					Signature Counter
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
							const isOwner = account && (
								nft.owner.toLowerCase() === account.toLowerCase() ||
								(safeAddress && nft.owner.toLowerCase() === safeAddress.toLowerCase())
							);

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

			{activeTab === 'counter' && (
				<div>
					<h2 style={{ marginBottom: '20px', color: '#333' }}>Signature Counter Testing</h2>
					<p style={{ color: '#666', marginBottom: '30px' }}>
						This counter can only be updated using EIP-1271 signatures from the Smart Wallet owner.
					</p>

					<div style={{
						backgroundColor: 'white',
						borderRadius: '12px',
						padding: '30px',
						boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
						border: '1px solid #e0e0e0',
						maxWidth: '600px',
						margin: '0 auto'
					}}>
						{/* Current Count Display */}
						<div style={{
							textAlign: 'center',
							marginBottom: '30px',
							padding: '20px',
							backgroundColor: '#f8f9fa',
							borderRadius: '8px'
						}}>
							<h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Current Count</h3>
							<div style={{
								fontSize: '48px',
								fontWeight: 'bold',
								color: '#4CAF50',
								margin: '10px 0'
							}}>
								{currentCount}
							</div>
							<button
								onClick={loadCurrentCount}
								style={{
									backgroundColor: '#2196F3',
									color: 'white',
									border: 'none',
									padding: '8px 16px',
									borderRadius: '6px',
									fontSize: '14px',
									cursor: 'pointer'
								}}
							>
								Refresh Count
							</button>
						</div>

						{/* Update Form */}
						<div style={{ marginBottom: '20px' }}>
							<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
								New Count Value:
							</label>
							<input
								type="number"
								value={newCountValue}
								onChange={(e) => setNewCountValue(e.target.value)}
								placeholder="Enter new count value"
								style={{
									width: '100%',
									padding: '12px',
									borderRadius: '6px',
									border: '1px solid #ddd',
									fontSize: '16px',
									marginBottom: '15px'
								}}
							/>

							<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
								Nonce:
							</label>
							<input
								type="number"
								value={nonce}
								onChange={(e) => setNonce(e.target.value)}
								placeholder="Enter nonce (unique number)"
								style={{
									width: '100%',
									padding: '12px',
									borderRadius: '6px',
									border: '1px solid #ddd',
									fontSize: '16px',
									marginBottom: '15px'
								}}
							/>

							<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
								Signature:
							</label>
							<textarea
								value={signature}
								onChange={(e) => setSignature(e.target.value)}
								placeholder="Generated signature will appear here or paste your signature"
								rows={3}
								style={{
									width: '100%',
									padding: '12px',
									borderRadius: '6px',
									border: '1px solid #ddd',
									fontSize: '14px',
									fontFamily: 'monospace',
									resize: 'vertical'
								}}
							/>
						</div>

						{/* Action Buttons */}
						<div style={{
							display: 'flex',
							gap: '15px',
							justifyContent: 'center',
							flexWrap: 'wrap'
						}}>
							<button
								onClick={generateSignature}
								disabled={!newCountValue || !nonce || counterStatus.includes("...")}
								style={{
									backgroundColor: (!newCountValue || !nonce || counterStatus.includes("...")) ? '#ccc' : '#ff9800',
									color: 'white',
									border: 'none',
									padding: '12px 24px',
									borderRadius: '8px',
									fontSize: '16px',
									cursor: (!newCountValue || !nonce || counterStatus.includes("...")) ? 'not-allowed' : 'pointer',
									boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
								}}
							>
								Generate Signature
							</button>

							<button
								onClick={updateCountWithSignature}
								disabled={!signature || !newCountValue || !nonce || counterStatus.includes("...") || !safeAddress}
								style={{
									backgroundColor: (!signature || !newCountValue || !nonce || counterStatus.includes("...") || !safeAddress) ? '#ccc' : '#4CAF50',
									color: 'white',
									border: 'none',
									padding: '12px 24px',
									borderRadius: '8px',
									fontSize: '16px',
									cursor: (!signature || !newCountValue || !nonce || counterStatus.includes("...") || !safeAddress) ? 'not-allowed' : 'pointer',
									boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
								}}
							>
								Update Count via Safe
							</button>
						</div>

						{/* Status Display */}
						{counterStatus && (
							<div style={{
								marginTop: '20px',
								padding: '15px',
								borderRadius: '8px',
								backgroundColor: counterStatus.includes("Successfully") || counterStatus.includes("✅") ? '#d4edda' : '#f8d7da',
								color: counterStatus.includes("Successfully") || counterStatus.includes("✅") ? '#155724' : '#721c24',
								border: `1px solid ${counterStatus.includes("Successfully") || counterStatus.includes("✅") ? '#c3e6cb' : '#f5c6cb'}`
							}}>
								{counterStatus}
							</div>
						)}

						{/* Instructions */}
						<div style={{
							marginTop: '30px',
							padding: '20px',
							backgroundColor: '#e3f2fd',
							borderRadius: '8px',
							fontSize: '14px',
							lineHeight: '1.5'
						}}>
							<h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>Instructions:</h4>
							<ol style={{ margin: '0', paddingLeft: '20px' }}>
								<li>Make sure you have a connected Safe wallet</li>
								<li>Enter a new count value and a unique nonce</li>
								<li>Click "Generate Signature" to create the EIP712 signature</li>
								<li>Click "Update Count via Safe" to execute the transaction</li>
								<li>The Safe wallet will prompt you to sign and execute the transaction</li>
							</ol>
							<p style={{ margin: '15px 0 0 0', fontStyle: 'italic' }}>
								Note: Only the Safe wallet owner can generate valid signatures for count updates.
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
