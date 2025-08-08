import { createClient } from "@libsql/client";
import { serve } from "bun";
import { ethers } from "ethers";

const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";

// Crown NFT Contract Addresses (Updated to V5 - Fixed Signature Verification)
const CROWN_NFT_ADDRESS = "0x602158126D46767D1e0B7eA91F246a1dbE06C71D"; // New V5 Clean NFT Contract
const CROWN_PURCHASE_ADDRESS = "0x7836C0BD3A34Fc03415CCA04937f8c5E8c915FA3"; // New V5 Marketplace Contract (Fixed)
const DARK_TOKEN_ADDRESS = "0x9740D146D20FCF8643274cCD4Db91210200c9ed4";

const CONTRACT_ABI = [
	"event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const PURCHASE_CONTRACT_ABI = [
	"event NFTPurchased(address indexed buyer, uint256 indexed tokenId, uint256 price)",
	"event PriceUpdated(uint256 oldPrice, uint256 newPrice)",
	"function getNFTPrice() view returns (uint256)",
	"function nonces(address owner) view returns (uint256)"
];

const client = createClient({
	authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTM4NTYxMDksImlkIjoiYWE0NmIyMTUtZTViYS00MzFmLWFlYzItYjk2NDlhOGExOWY0IiwicmlkIjoiZWM5Nzg4ODUtNDk0OC00YWQ5LTk2MjUtMzMzNDBlOTZhYWMyIn0.Mlp_hoVmHvRZ2t_MoAmIwzt2cBCzbgs92pHWOMkoAJoYUio1JvEiA6uyHuhEsQM7l25m6E5Tg51gmjtnLFnaCQ",
	url: "libsql://nft-test-achuvyas-kv.aws-ap-south-1.turso.io",
});

const provider = new ethers.JsonRpcProvider(INFURA_URL);
const contract = new ethers.Contract(CROWN_NFT_ADDRESS, CONTRACT_ABI, provider);
const purchaseContract = new ethers.Contract(CROWN_PURCHASE_ADDRESS, PURCHASE_CONTRACT_ABI, provider);

// Database schema
const schema = `
CREATE TABLE IF NOT EXISTS owners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nfts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL UNIQUE,
  contract_address TEXT NOT NULL,
  metadata_uri TEXT,
  owner_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  seller_address TEXT NOT NULL,
  price TEXT NOT NULL,
  signature TEXT NOT NULL,
  deadline INTEGER NOT NULL,
  nonce INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_id, contract_address, seller_address)
);
`;

// Initialize database
await client.batch(
	schema
		.split(";")
		.map(stmt => stmt.trim())
		.filter(Boolean)
		.map(sql => ({ sql }))
);

console.log("✅ Database tables created.");

// Listen for Transfer events
contract.on("Transfer", async (from, to, tokenId, event) => {
	console.log("🔔 Transfer Event:");
	console.log("From:", from);
	console.log("To:", to);
	console.log("Token ID:", tokenId.toString());
	
	try {
		// Skip zero address (minting from zero address)
		if (from === ethers.ZeroAddress) {
			console.log("🎨 NFT Minted - Token ID:", tokenId.toString());
		} else {
			console.log("📦 NFT Transferred - Token ID:", tokenId.toString());
		}

		// Ensure new owner exists
		const ownerResult = await client.execute({
			sql: "INSERT INTO owners (address) VALUES (?) ON CONFLICT(address) DO NOTHING RETURNING id",
			args: [to],
		});

		let ownerId = ownerResult.rows?.[0]?.id;
		if (!ownerId) {
			const res = await client.execute({
				sql: "SELECT id FROM owners WHERE address = ?",
				args: [to],
			});
			ownerId = res.rows[0]?.id;
		}

		// Check if NFT exists
		const nftResult = await client.execute({
			sql: "SELECT id FROM nfts WHERE token_id = ? AND contract_address = ?",
			args: [tokenId.toString(), CROWN_NFT_ADDRESS],
		});

		if (nftResult.rows.length === 0) {
			// Create new NFT
			await client.execute({
				sql: "INSERT INTO nfts (token_id, contract_address, metadata_uri, owner_id) VALUES (?, ?, NULL, ?)",
				args: [tokenId.toString(), CROWN_NFT_ADDRESS, ownerId],
			});
			console.log("✅ New CrownNFT inserted");
		} else {
			// Update ownership of existing NFT
			await client.execute({
				sql: "UPDATE nfts SET owner_id = ? WHERE token_id = ? AND contract_address = ?",
				args: [ownerId, tokenId.toString(), CROWN_NFT_ADDRESS],
			});
			console.log("✅ CrownNFT ownership updated");
		}

	} catch (e) {
		console.error("❌ Error processing Transfer event:", e);
	}
});

// Listen for NFTPurchased events from CrownPurchase contract
purchaseContract.on("NFTPurchased", async (buyer, tokenId, price, event) => {
	console.log("💰 NFTPurchased Event:");
	console.log("Buyer:", buyer);
	console.log("Token ID:", tokenId.toString());
	console.log("Price:", ethers.formatUnits(price, 18), "DARK");
	
	try {
		// Ensure buyer exists in owners table
		const ownerResult = await client.execute({
			sql: "INSERT INTO owners (address) VALUES (?) ON CONFLICT(address) DO NOTHING RETURNING id",
			args: [buyer],
		});

		let ownerId = ownerResult.rows?.[0]?.id;
		if (!ownerId) {
			const res = await client.execute({
				sql: "SELECT id FROM owners WHERE address = ?",
				args: [buyer],
			});
			ownerId = res.rows[0]?.id;
		}

		// Check if NFT already exists (it might have been processed by Transfer event)
		const nftResult = await client.execute({
			sql: "SELECT id FROM nfts WHERE token_id = ? AND contract_address = ?",
			args: [tokenId.toString(), CROWN_NFT_ADDRESS],
		});

		if (nftResult.rows.length === 0) {
			// Create new NFT record if it doesn't exist
			await client.execute({
				sql: "INSERT INTO nfts (token_id, contract_address, metadata_uri, owner_id) VALUES (?, ?, NULL, ?)",
				args: [tokenId.toString(), CROWN_NFT_ADDRESS, ownerId],
			});
			console.log("✅ New CrownNFT inserted from Purchase event");
		} else {
			// Update ownership to ensure it's correct
			await client.execute({
				sql: "UPDATE nfts SET owner_id = ? WHERE token_id = ? AND contract_address = ?",
				args: [ownerId, tokenId.toString(), CROWN_NFT_ADDRESS],
			});
			console.log("✅ CrownNFT ownership confirmed from Purchase event");
		}

	} catch (e) {
		console.error("❌ Error processing NFTPurchased event:", e);
	}
});

// Sync past transfers function
async function syncPastTransfers() {
	console.log("🔄 Syncing past transfers...");
	const fromBlock = 0;
	const toBlock = "latest";

	try {
		const events = await contract.queryFilter("Transfer", fromBlock, toBlock);
		console.log(`Found ${events.length} Transfer events`);

		for (const event of events) {
			const eventLog = event as ethers.EventLog;
			if (!eventLog.args) continue;
			const { from, to, tokenId } = eventLog.args;

			// Insert or ignore owner
			await client.execute({
				sql: `INSERT OR IGNORE INTO owners (address) VALUES (?)`,
				args: [to],
			});

			// Get owner's ID
			const ownerResult = await client.execute({
				sql: `SELECT id FROM owners WHERE address = ?`,
				args: [to],
			});

			const ownerId = ownerResult.rows[0]?.id;

			// Insert or update NFT
			await client.execute({
				sql: `
					INSERT INTO nfts (token_id, contract_address, owner_id)
					VALUES (?, ?, ?)
					ON CONFLICT(token_id) DO UPDATE SET owner_id = excluded.owner_id;
				`,
				args: [tokenId.toString(), CROWN_NFT_ADDRESS, ownerId],
			});
		}

		console.log(`✅ Synced ${events.length} Transfer events`);
		return { success: true, eventsProcessed: events.length };
	} catch (error) {
		console.error("❌ Sync failed:", error);
		throw error;
	}
}

// Sync past NFTPurchased events function
async function syncPastPurchases() {
	console.log("🔄 Syncing past NFTPurchased events...");
	const fromBlock = 0;
	const toBlock = "latest";

	try {
		const events = await purchaseContract.queryFilter("NFTPurchased", fromBlock, toBlock);
		console.log(`Found ${events.length} NFTPurchased events`);

		for (const event of events) {
			const eventLog = event as ethers.EventLog;
			if (!eventLog.args) continue;
			const { buyer, tokenId, price } = eventLog.args;

			// Insert or ignore owner
			await client.execute({
				sql: `INSERT OR IGNORE INTO owners (address) VALUES (?)`,
				args: [buyer],
			});

			// Get owner's ID
			const ownerResult = await client.execute({
				sql: `SELECT id FROM owners WHERE address = ?`,
				args: [buyer],
			});

			const ownerId = ownerResult.rows[0]?.id;

			// Insert or update NFT
			await client.execute({
				sql: `
					INSERT INTO nfts (token_id, contract_address, owner_id)
					VALUES (?, ?, ?)
					ON CONFLICT(token_id) DO UPDATE SET owner_id = excluded.owner_id;
				`,
				args: [tokenId.toString(), CROWN_NFT_ADDRESS, ownerId],
			});
		}

		console.log(`✅ Synced ${events.length} NFTPurchased events`);
		return { success: true, eventsProcessed: events.length };
	} catch (error) {
		console.error("❌ Purchase sync failed:", error);
		throw error;
	}
}

// CORS headers
const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

// Start the server
serve({
	port: 3000,
	async fetch(req) {
		const url = new URL(req.url);

		// Handle CORS preflight
		if (req.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		// GET /nfts?owner=0x123... (user's NFTs)
		if (url.pathname === "/nfts") {
			const owner = url.searchParams.get("owner");

			if (!owner) {
				return new Response(
					JSON.stringify({ error: "Missing `owner` query param" }),
					{
						status: 400,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders
						}
					}
				);
			}

			try {
				// Lookup owner ID
				const ownerResult = await client.execute({
					sql: `SELECT id FROM owners WHERE address = ?`,
					args: [owner],
				});

				if (ownerResult.rows.length === 0) {
					return new Response(JSON.stringify([]), {
						headers: {
							"Content-Type": "application/json",
							...corsHeaders
						},
					});
				}

				const ownerId = ownerResult?.rows[0]?.id ?? "";

				// Get NFTs for this owner
				const nftsResult = await client.execute({
					sql: `SELECT token_id, contract_address, metadata_uri, created_at FROM nfts WHERE owner_id = ? AND contract_address = ?`,
					args: [ownerId, CROWN_NFT_ADDRESS],
				});

				return new Response(JSON.stringify(nftsResult.rows), {
					headers: { "Content-Type": "application/json", ...corsHeaders },
				});
			} catch (error) {
				console.error("Error fetching user NFTs:", error);
				return new Response(
					JSON.stringify({ error: "Failed to fetch user NFTs" }),
					{
						status: 500,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders
						}
					}
				);
			}
		}

		// GET /all-nfts (all NFTs with owner info)
		if (url.pathname === "/all-nfts") {
			try {
				// Get all CrownNFTs with owner information and listing status
				const allNftsResult = await client.execute({
					sql: `
						SELECT 
							n.token_id, 
							n.contract_address, 
							n.metadata_uri, 
							n.created_at,
							o.address as owner_address,
							l.price as listing_price,
							l.is_active as is_listed,
							l.deadline as listing_deadline
						FROM nfts n
						JOIN owners o ON n.owner_id = o.id
						LEFT JOIN listings l ON n.token_id = l.token_id 
							AND n.contract_address = l.contract_address 
							AND l.is_active = 1
							AND l.deadline > ?
						WHERE n.contract_address = ?
						ORDER BY CAST(n.token_id AS INTEGER) ASC
					`,
					args: [Math.floor(Date.now() / 1000), CROWN_NFT_ADDRESS]
				});

				console.log(`Found ${allNftsResult.rows.length} CrownNFTs in database`);

				return new Response(JSON.stringify(allNftsResult.rows), {
					headers: { "Content-Type": "application/json", ...corsHeaders },
				});
			} catch (error) {
				console.error("Error fetching all NFTs:", error);
				return new Response(
					JSON.stringify({ error: "Failed to fetch all NFTs" }),
					{
						status: 500,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders
						}
					}
				);
			}
		}

		// Create NFT listing
		if (url.pathname === "/create-listing" && req.method === "POST") {
			try {
				const body = await req.json() as any;
				const { tokenId, contractAddress, sellerAddress, price, signature, deadline, nonce } = body;
				
				// Validate required fields
				if (!tokenId || !contractAddress || !sellerAddress || !price || !signature || !deadline || nonce === undefined) {
					return new Response(
						JSON.stringify({ error: "Missing required fields: tokenId, contractAddress, sellerAddress, price, signature, deadline, nonce" }),
						{ 
							status: 400, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}

				// Verify the seller owns the NFT
				const ownerResult = await client.execute({
					sql: `
						SELECT o.address 
						FROM nfts n 
						JOIN owners o ON n.owner_id = o.id 
						WHERE n.token_id = ? AND n.contract_address = ?
					`,
					args: [tokenId, contractAddress]
				});

				if (ownerResult.rows.length === 0) {
					return new Response(
						JSON.stringify({ error: "NFT not found" }),
						{ 
							status: 404, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}

				const actualOwner = ownerResult.rows[0]?.address as string;
				if (actualOwner.toLowerCase() !== sellerAddress.toLowerCase()) {
					return new Response(
						JSON.stringify({ error: "You don't own this NFT" }),
						{ 
							status: 403, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}

				// Verify the seller's signature for listing authorization
				try {
					const { ethers } = await import("ethers");
					
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

					const message = {
						seller: sellerAddress,
						tokenId: parseInt(tokenId),
						price: price,
						deadline: deadline
					};

					console.log("Verifying signature with:", { domain, types, message, signature, expectedSigner: sellerAddress });
					
					const recoveredAddress = ethers.verifyTypedData(domain, types, message, signature);
					console.log("Recovered address:", recoveredAddress, "Expected:", sellerAddress);
					
					if (recoveredAddress.toLowerCase() !== sellerAddress.toLowerCase()) {
						return new Response(
							JSON.stringify({ error: "Invalid seller signature" }),
							{ 
								status: 403, 
								headers: { ...corsHeaders, "Content-Type": "application/json" }
							}
						);
					}
					
					console.log(`✅ Verified listing authorization signature from ${sellerAddress}`);
				} catch (err) {
					console.error("Signature verification failed:", err);
					return new Response(
						JSON.stringify({ error: "Invalid signature format" }),
						{ 
							status: 400, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}

				// Store listing in database with user's authorization signature
				await client.execute({
					sql: `
						INSERT OR REPLACE INTO listings 
						(token_id, contract_address, seller_address, price, signature, deadline, nonce, is_active, updated_at) 
						VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
					`,
					args: [tokenId.toString(), contractAddress, sellerAddress, price, signature, deadline, nonce]
				});

				console.log(`✅ NFT #${tokenId} listed for sale by ${sellerAddress} at ${ethers.formatUnits(price, 18)} DARK`);

				return new Response(
					JSON.stringify({
						success: true,
						message: "NFT listed successfully",
						listing: {
							tokenId,
							contractAddress,
							sellerAddress,
							price,
							deadline,
							nonce
						}
					}),
					{ 
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					}
				);
				
			} catch (error) {
				console.error("❌ Create listing failed:", error);
				return new Response(
					JSON.stringify({ 
						error: error instanceof Error ? error.message : "Unknown error" 
					}),
					{ 
						status: 500, 
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					}
				);
			}
		}

		// Get listing data and generate signature for purchase
		if (url.pathname === "/get-listing-signature" && req.method === "POST") {
			try {
				const body = await req.json() as any;
				const { tokenId, contractAddress, buyerAddress } = body;
				
				if (!tokenId || !contractAddress || !buyerAddress) {
					return new Response(
						JSON.stringify({ error: "Missing tokenId, contractAddress, or buyerAddress" }),
						{ 
							status: 400, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}
				console.log(tokenId,contractAddress, Math.floor(Date.now() / 1000))

				// Get active listing
				const currentTimestamp = Math.floor(Date.now() / 1000);
				
				// Ensure tokenId is treated as string for database consistency
				const tokenIdStr = tokenId.toString();
				
				const listingResult = await client.execute({
					sql: `
						SELECT * FROM listings 
						WHERE token_id = ? AND contract_address = ? AND is_active = 1 AND deadline > ?
						ORDER BY created_at DESC LIMIT 1
					`,
					args: [tokenIdStr, contractAddress, currentTimestamp]
				});

				if (listingResult.rows.length === 0) {
					return new Response(
						JSON.stringify({ error: "No active listing found for this NFT" }),
						{ 
							status: 404, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}

				const listing = listingResult.rows[0] as any;

				// Verify the stored listing authorization signature is still valid
				try {
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

					const message = {
						seller: listing.seller_address,
						tokenId: parseInt(listing.token_id),
						price: listing.price,
						deadline: listing.deadline
					};

					const recoveredAddress = ethers.verifyTypedData(domain, types, message, listing.signature);
					
					if (recoveredAddress.toLowerCase() !== listing.seller_address.toLowerCase()) {
						return new Response(
							JSON.stringify({ error: "Invalid listing authorization" }),
							{ 
								status: 403, 
								headers: { ...corsHeaders, "Content-Type": "application/json" }
							}
						);
					}
					
					console.log(`✅ Verified listing authorization for purchase`);
				} catch (err) {
					console.error("Listing authorization verification failed:", err);
					return new Response(
						JSON.stringify({ error: "Invalid listing authorization signature" }),
						{ 
							status: 400, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}

				// Check if seller still owns the NFT on the blockchain
				const nftContract = new ethers.Contract(contractAddress, [
					"function ownerOf(uint256 tokenId) view returns (address)"
				], provider);
				
				const currentOwner = await nftContract.ownerOf!(parseInt(listing.token_id));
				console.log(`Current NFT owner on blockchain: ${currentOwner}`);
				console.log(`Seller in listing: ${listing.seller_address}`);
				
				if (currentOwner.toLowerCase() !== listing.seller_address.toLowerCase()) {
					return new Response(
						JSON.stringify({ error: `NFT is no longer owned by the seller. Current owner: ${currentOwner}` }),
						{ 
							status: 400, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}
				
				// Get current nonce from the blockchain (not the stored one)
				const currentNonce = await purchaseContract.getFunction("nonces")(listing.seller_address);
				console.log(`Current nonce for seller ${listing.seller_address}: ${currentNonce}, stored nonce: ${listing.nonce}`);
				
				// Generate transfer signature with the buyer address using admin key
				const { generateTransferSignature } = await import("./generate-eip712-signature.js");
				
				const transferData = {
					from: listing.seller_address,
					to: buyerAddress,
					tokenId: parseInt(listing.token_id),
					price: listing.price,
					deadline: listing.deadline,
					nonce: Number(currentNonce)  // Use current nonce from blockchain
				};

				const signature = await generateTransferSignature(transferData);

				return new Response(
					JSON.stringify({
						success: true,
						signature,
						transferData,
						timestamp: Math.floor(Date.now() / 1000)
					}),
					{ 
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					}
				);
				
			} catch (error) {
				console.error("❌ Get listing signature failed:", error);
				return new Response(
					JSON.stringify({ 
						error: error instanceof Error ? error.message : "Unknown error" 
					}),
					{ 
						status: 500, 
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					}
				);
			}
		}

		// Get listing data for purchase (without signature)
		if (url.pathname === "/get-listing" && req.method === "GET") {
			try {
				const tokenId = url.searchParams.get("tokenId");
				const contractAddress = url.searchParams.get("contractAddress");
				
				if (!tokenId || !contractAddress) {
					return new Response(
						JSON.stringify({ error: "Missing tokenId or contractAddress parameters" }),
						{ 
							status: 400, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}

				// Get active listing
				const tokenIdStr = tokenId.toString();
				const listingResult = await client.execute({
					sql: `
						SELECT * FROM listings 
						WHERE token_id = ? AND contract_address = ? AND is_active = 1 AND deadline > ?
						ORDER BY created_at DESC LIMIT 1
					`,
					args: [tokenIdStr, contractAddress, Math.floor(Date.now() / 1000)]
				});

				if (listingResult.rows.length === 0) {
					return new Response(
						JSON.stringify({ error: "No active listing found for this NFT" }),
						{ 
							status: 404, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}

				const listing = listingResult.rows[0] as any;

				return new Response(
					JSON.stringify({
						success: true,
						listing: {
							tokenId: listing.token_id,
							contractAddress: listing.contract_address,
							sellerAddress: listing.seller_address,
							price: listing.price,
							deadline: listing.deadline,
							nonce: listing.nonce
						}
					}),
					{ 
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					}
				);
				
			} catch (error) {
				console.error("❌ Get listing failed:", error);
				return new Response(
					JSON.stringify({ 
						error: error instanceof Error ? error.message : "Unknown error" 
					}),
					{ 
						status: 500, 
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					}
				);
			}
		}

		// Generate EIP712 transfer signature
		if (url.pathname === "/generate-transfer-signature" && req.method === "POST") {
			try {
				const body = await req.json() as any;
				const { from, to, tokenId, price } = body;
				
				// Validate required fields
				if (!from || !to || tokenId === undefined || !price) {
					return new Response(
						JSON.stringify({ error: "Missing required fields: from, to, tokenId, price" }),
						{ 
							status: 400, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}

				// Get current nonce from purchase contract
				const nonce = await purchaseContract.getFunction("nonces")(from);
				console.log(`Getting nonce for ${from}: ${nonce}`);

				// Set deadline to 1 hour from now
				const deadline = Math.floor(Date.now() / 1000) + 3600;

				// Import and use the EIP712 signature generation
				const { generateTransferSignature } = await import("./generate-eip712-signature.js");
				
				const transferData = {
					from,
					to,
					tokenId: parseInt(tokenId),
					price: price.toString(),
					deadline,
					nonce: Number(nonce)
				};

				const signature = await generateTransferSignature(transferData);

				return new Response(
					JSON.stringify({
						success: true,
						signature,
						transferData,
						timestamp: Math.floor(Date.now() / 1000)
					}),
					{ 
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					}
				);
				
			} catch (error) {
				console.error("❌ Transfer signature generation failed:", error);
				return new Response(
					JSON.stringify({ 
						error: error instanceof Error ? error.message : "Unknown error" 
					}),
					{ 
						status: 500, 
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					}
				);
			}
		}

		// Sync past transfers to populate database
		if (url.pathname === "/sync") {
			try {
				const transferResult = await syncPastTransfers();
				const purchaseResult = await syncPastPurchases();
				
				const totalEvents = transferResult.eventsProcessed + purchaseResult.eventsProcessed;
				
				return new Response(JSON.stringify({
					success: true,
					eventsProcessed: totalEvents,
					transferEvents: transferResult.eventsProcessed,
					purchaseEvents: purchaseResult.eventsProcessed
				}), {
					headers: {
						"Content-Type": "application/json",
						...corsHeaders
					},
				});
			} catch (error) {
				console.error("Sync failed:", error);
				return new Response(
					JSON.stringify({ error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" }),
					{
						status: 500,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders
						}
					}
				);
			}
		}

		// Migration endpoint to update contract addresses
		if (url.pathname === "/migrate-contract") {
			try {
				const oldContractAddress = "0x6E751200c5e007De65C8b0a926F1C3A25081e7a6"; // Old CrownNFT V1
				    const newContractAddress = CROWN_NFT_ADDRESS; // New CrownNFT V4

				// Update all NFTs from old contract to new contract
				const updateResult = await client.execute({
					sql: `UPDATE nfts SET contract_address = ? WHERE contract_address = ?`,
					args: [newContractAddress, oldContractAddress]
				});

				console.log(`✅ Migrated ${updateResult.rowsAffected} NFTs from ${oldContractAddress} to ${newContractAddress}`);

				return new Response(JSON.stringify({
					success: true,
					message: `Migrated ${updateResult.rowsAffected} NFTs`,
					oldContract: oldContractAddress,
					newContract: newContractAddress,
					rowsAffected: updateResult.rowsAffected
				}), {
					headers: {
						"Content-Type": "application/json",
						...corsHeaders
					},
				});
			} catch (error) {
				console.error("Migration failed:", error);
				return new Response(
					JSON.stringify({ error: "Migration failed", details: error instanceof Error ? error.message : "Unknown error" }),
					{
						status: 500,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders
						}
					}
				);
			}
		}

		// Debug endpoint to check database state
		if (url.pathname === "/debug-db") {
			try {
				const ownersResult = await client.execute({
					sql: `SELECT COUNT(*) as count FROM owners`
				});
				
				const nftsResult = await client.execute({
					sql: `SELECT COUNT(*) as count FROM nfts WHERE contract_address = ?`,
					args: [CROWN_NFT_ADDRESS]
				});

				// Get ALL NFTs regardless of contract address
				const allNftsResult = await client.execute({
					sql: `SELECT COUNT(*) as count FROM nfts`
				});

				const sampleNftsResult = await client.execute({
					sql: `
						SELECT n.token_id, n.contract_address, o.address as owner_address, n.created_at
						FROM nfts n
						JOIN owners o ON n.owner_id = o.id
						WHERE n.contract_address = ?
						ORDER BY CAST(n.token_id AS INTEGER) ASC
						LIMIT 10
					`,
					args: [CROWN_NFT_ADDRESS]
				});

				// Get ALL NFTs with different contract addresses
				const allSampleNftsResult = await client.execute({
					sql: `
						SELECT n.token_id, n.contract_address, o.address as owner_address, n.created_at
						FROM nfts n
						JOIN owners o ON n.owner_id = o.id
						ORDER BY CAST(n.token_id AS INTEGER) ASC
						LIMIT 10
					`
				});

				// Get unique contract addresses in the database
				const contractAddressesResult = await client.execute({
					sql: `SELECT DISTINCT contract_address FROM nfts`
				});

				return new Response(JSON.stringify({
					ownersCount: ownersResult.rows[0]?.count,
					crownNftsCount: nftsResult.rows[0]?.count,
					totalNftsCount: allNftsResult.rows[0]?.count,
					sampleCrownNfts: sampleNftsResult.rows,
					allSampleNfts: allSampleNftsResult.rows,
					contractAddresses: contractAddressesResult.rows,
					expectedContractAddress: CROWN_NFT_ADDRESS
				}), {
					headers: {
						"Content-Type": "application/json",
						...corsHeaders
					},
				});
			} catch (error) {
				console.error("Debug failed:", error);
				return new Response(
					JSON.stringify({ error: "Debug failed", details: error instanceof Error ? error.message : "Unknown error" }),
					{
						status: 500,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders
						}
					}
				);
			}
		}

		// Get contract info endpoint
		if (url.pathname === "/contract-info") {
			return new Response(JSON.stringify({
				crownNFT: CROWN_NFT_ADDRESS,
				crownPurchase: CROWN_PURCHASE_ADDRESS,
				darkToken: DARK_TOKEN_ADDRESS,
				network: "sepolia"
			}), {
				headers: {
					"Content-Type": "application/json",
					...corsHeaders
				},
			});
		}

		return new Response("Not Found", {
			status: 404,
			headers: corsHeaders
		});
	}
});

// Run initial sync when server starts
console.log("🚀 Crown NFT Server starting...");
console.log("📋 Contract Addresses:");
      console.log("  - CrownNFT V5 (Fixed):", CROWN_NFT_ADDRESS);
  console.log("  - CrownPurchase V5 (Fixed):", CROWN_PURCHASE_ADDRESS);
console.log("  - DarkToken:", DARK_TOKEN_ADDRESS);

try {
	await syncPastTransfers();
	await syncPastPurchases();
	console.log("✅ Initial sync completed");
} catch (error) {
	console.error("❌ Initial sync failed:", error);
}

console.log("👂 Listening for Transfer events...");
console.log("💰 Listening for NFTPurchased events...");
console.log("🌐 Server running on http://localhost:3000");
