import { createClient } from "@libsql/client";
import { serve } from "bun";
import { ethers } from "ethers";
import { collapseTextChangeRangesAcrossMultipleVersions } from "typescript";
import { handleGenerateSignature } from "./generate-counter-signature";

const RPC_HTTP_URL = process.env.RPC_HTTP_URL || "https://eth-sepolia.g.alchemy.com/v2/nqF678YEpSD8Wj-hm0pwN";
const RPC_WS_URL = process.env.RPC_WS_URL || "wss://eth-sepolia.g.alchemy.com/v2/nqF678YEpSD8Wj-hm0pwN";

// Crown NFT Contract Addresses (Updated to V5 - Fixed Signature Verification)
const CROWN_NFT_ADDRESS = "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6"; // V8 CrownNFTSimple
const CROWN_PURCHASE_ADDRESS = "0xB7Aa678187441466e11B2EFCF6a9716AC7Bb840c"; // V8 CrownPurchase (buyer-agnostic EIP-712)
const DARK_TOKEN_ADDRESS = "0x4d4C324C3a408476e25887025dDbA50839ECd7B1"; // Deployed DarkToken

const CONTRACT_ABI = [
	"event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const PURCHASE_CONTRACT_ABI = [
	"event NFTPurchased(address indexed buyer, uint256 indexed tokenId, uint256 price)",
	"event PriceUpdated(uint256 oldPrice, uint256 newPrice)",
	"event MarketplaceTransfer(address indexed from, address indexed to, uint256 indexed tokenId, uint256 price)",
	"function getNFTPrice() view returns (uint256)",
	"function nonces(address owner) view returns (uint256)"
];

const client = createClient({
	authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTM4NTYxMDksImlkIjoiYWE0NmIyMTUtZTViYS00MzFmLWFlYzItYjk2NDlhOGExOWY0IiwicmlkIjoiZWM5Nzg4ODUtNDk0OC00YWQ5LTk2MjUtMzMzNDBlOTZhYWMyIn0.Mlp_hoVmHvRZ2t_MoAmIwzt2cBCzbgs92pHWOMkoAJoYUio1JvEiA6uyHuhEsQM7l25m6E5Tg51gmjtnLFnaCQ",
	url: "libsql://nft-test-achuvyas-kv.aws-ap-south-1.turso.io",
});

const provider = new ethers.JsonRpcProvider(RPC_HTTP_URL, { name: "sepolia", chainId: 11155111 });
// Slow down polling to reduce RPC load / rate-limit issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(provider as any).pollingInterval = 30000;
const contract = new ethers.Contract(CROWN_NFT_ADDRESS, CONTRACT_ABI, provider);
const purchaseContract = new ethers.Contract(CROWN_PURCHASE_ADDRESS, PURCHASE_CONTRACT_ABI, provider);

// For event subscriptions (kept disabled), prefer WebSocket provider (set RPC_WS_URL env):
// const wsProvider = new ethers.WebSocketProvider(RPC_WS_URL, { name: "sepolia", chainId: 11155111 });
// const wsContract = new ethers.Contract(CROWN_NFT_ADDRESS, CONTRACT_ABI, wsProvider);
// const wsPurchaseContract = new ethers.Contract(CROWN_PURCHASE_ADDRESS, PURCHASE_CONTRACT_ABI, wsProvider);

// Limit how far back we sync to reduce RPC load
const SYNC_LOOKBACK_BLOCKS = 200_000; // ~ look back range; adjust as needed
// Provider block range cap for eth_getLogs (Alchemy public: 500). Use 450 to be safe.
const LOGS_MAX_BLOCK_RANGE = Number(process.env.LOGS_MAX_BLOCK_RANGE || 450);

// Utility: sleep
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility: detect Infura rate-limit error
function isRateLimitError(err: any): boolean {
	console.log(err)
    try {
        if (!err) return false;
        const msg = String(err.message || err.shortMessage || "");
        if (msg.toLowerCase().includes("too many requests")) return true;
        if (err.code === "BAD_DATA") {
            const value = err.value || [];
            if (Array.isArray(value)) {
                return value.some((v) => v && (v.code === -32005 || String(v.message || "").toLowerCase().includes("too many requests")));
            }
        }
    } catch {}
    return false;
}

// Utility: execute with exponential backoff on rate-limit
async function withBackoff<T>(fn: () => Promise<T>, maxAttempts = 5, baseDelayMs = 1000): Promise<T> {
    let attempt = 0;
    let delay = baseDelayMs;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            return await fn();
        } catch (err) {
            if (isRateLimitError(err) && attempt < maxAttempts) {
                attempt++;
                console.warn(`RPC rate-limited; retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
                await sleep(delay);
                delay *= 2;
                continue;
            }
            throw err;
        }
    }
}

// Utility: query events in chunks to avoid getLogs over-large ranges
async function queryFilterChunked(
    ctr: ethers.Contract,
    eventName: string,
    fromBlock: number,
    toBlock: number,
    chunkSize = LOGS_MAX_BLOCK_RANGE
) {
    const events: ethers.EventLog[] = [];
    let start = fromBlock;
    while (start <= toBlock) {
        const end = Math.min(start + chunkSize - 1, toBlock);
        const res = await withBackoff(() => ctr.queryFilter(eventName, start, end));
        events.push(...(res as ethers.EventLog[]));
        start = end + 1;
        // small pacing delay to be nice to the RPC
        await sleep(200);
    }
    return events;
}

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
  signer_address TEXT,
  is_safe_wallet BOOLEAN DEFAULT FALSE,
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

// Listen for marketplace resale transfers to deactivate listings
// purchaseContract.on("MarketplaceTransfer", async (from, to, tokenId, price, event) => {
//     console.log("🔄 MarketplaceTransfer Event:");
//     console.log("From:", from);
//     console.log("To:", to);
//     console.log("Token ID:", tokenId.toString());
//     console.log("Price:", ethers.formatUnits(price, 18), "DARK");
//
//     try {
//         // Deactivate any active listing for this tokenId and seller
//         const res = await client.execute({
//             sql: `UPDATE listings SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE token_id = ? AND contract_address = ? AND seller_address = ? AND is_active = 1`,
//             args: [tokenId.toString(), CROWN_NFT_ADDRESS, from]
//         });
//         console.log(`✅ Deactivated ${res.rowsAffected} listing(s) for token ${tokenId} from ${from}`);
//     } catch (e) {
//         console.error("❌ Error deactivating listing on MarketplaceTransfer:", e);
//     }
// });

// Sync past transfers function
async function syncPastTransfers() {
	console.log("🔄 Syncing past transfers...");
	const latest = await withBackoff(() => provider.getBlockNumber());
	const fromBlock = Math.max(0, Number(latest) - SYNC_LOOKBACK_BLOCKS);
	console.log(`Querying Transfer events from block ${fromBlock} to ${latest}`);

	try {
		const events = await queryFilterChunked(contract, "Transfer", fromBlock, latest);
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
	const latest = await withBackoff(() => provider.getBlockNumber());
	const fromBlock = Math.max(0, Number(latest) - SYNC_LOOKBACK_BLOCKS);
	console.log(`Querying NFTPurchased events from block ${fromBlock} to ${latest}`);

	try {
		const events = await queryFilterChunked(purchaseContract, "NFTPurchased", fromBlock, latest);
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

// Sync past MarketplaceTransfer events to deactivate any lingering listings
async function syncPastMarketplaceTransfers() {
    console.log("🔄 Syncing past MarketplaceTransfer events...");
    const latest = await withBackoff(() => provider.getBlockNumber());
    const fromBlock = Math.max(0, Number(latest) - SYNC_LOOKBACK_BLOCKS);
    console.log(`Querying MarketplaceTransfer events from block ${fromBlock} to ${latest}`);

    try {
        const events = await queryFilterChunked(purchaseContract, "MarketplaceTransfer", fromBlock, latest);
        console.log(`Found ${events.length} MarketplaceTransfer events`);

        for (const event of events) {
            const eventLog = event as ethers.EventLog;
            if (!eventLog.args) continue;
            const { from, to, tokenId, price } = eventLog.args as any;

            await client.execute({
                sql: `UPDATE listings SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE token_id = ? AND contract_address = ? AND seller_address = ? AND is_active = 1`,
                args: [tokenId.toString(), CROWN_NFT_ADDRESS, from]
            });
        }

        console.log(`✅ Synced ${events.length} MarketplaceTransfer events`);
        return { success: true, eventsProcessed: events.length };
    } catch (error) {
        console.error("❌ MarketplaceTransfer sync failed:", error);
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
				const { tokenId, contractAddress, sellerAddress, price, signature, deadline, nonce, signerAddress, isSafeWallet } = body;
				
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

				// Verify the seller's transfer signature
				try {
					const { ethers } = await import("ethers");
					
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

					const message = {
						from: sellerAddress,
						tokenId: parseInt(tokenId),
						price: price,
						deadline: deadline,
						nonce: nonce
					};

					const recoveredAddress = ethers.verifyTypedData(domain, types, message, signature);
					console.log("Recovered signer:", recoveredAddress);
					
					// Accept EOA owner signatures when NFT owner is a Safe wallet
					let expectedSigner = sellerAddress;
					if (isSafeWallet && signerAddress) {
						expectedSigner = signerAddress;
						console.log("Safe listing: accepting EOA owner signature from:", expectedSigner);
					}
					
					if (recoveredAddress.toLowerCase() !== expectedSigner.toLowerCase()) {
						return new Response(
							JSON.stringify({ 
								error: "Invalid seller signature", 
								details: `Expected signature from ${expectedSigner}, got ${recoveredAddress}`
							}),
							{ 
								status: 403, 
								headers: { ...corsHeaders, "Content-Type": "application/json" }
							}
						);
					}
					
					console.log("✅ Transfer signature verified successfully");
				} catch (err) {
					console.error("Transfer signature verification failed:", err);
					return new Response(
						JSON.stringify({ error: "Invalid transfer signature" }),
						{ 
							status: 400, 
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						}
					);
				}

				// Store listing in database with transfer signature
				await client.execute({
					sql: `
						INSERT OR REPLACE INTO listings 
						(token_id, contract_address, seller_address, price, signature, deadline, nonce, signer_address, is_safe_wallet, is_active, updated_at) 
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
					`,
					args: [tokenId.toString(), contractAddress, sellerAddress, price, signature, deadline, nonce, signerAddress ?? null, isSafeWallet ? 1 : 0]
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
				const { tokenId, contractAddress, buyerAddress, sellerAddress } = body;
				
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
				
				// Build query to find listing - if sellerAddress is provided, use it to find the specific listing
				let listingResult;
				if (sellerAddress) {
					listingResult = await client.execute({
						sql: `
							SELECT * FROM listings 
							WHERE token_id = ? AND contract_address = ? AND seller_address = ? AND is_active = 1 AND deadline > ?
							ORDER BY created_at DESC LIMIT 1
						`,
						args: [tokenIdStr, contractAddress, sellerAddress, currentTimestamp]
					});
				} else {
					listingResult = await client.execute({
						sql: `
							SELECT * FROM listings 
							WHERE token_id = ? AND contract_address = ? AND is_active = 1 AND deadline > ?
							ORDER BY created_at DESC LIMIT 1
						`,
						args: [tokenIdStr, contractAddress, currentTimestamp]
					});
				}
				console.log(listingResult)

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
				// Immediately return stored signature and transfer data
				const transferData = {
					from: listing.seller_address,
					to: buyerAddress,
					tokenId: parseInt(listing.token_id),
					price: listing.price,
					deadline: listing.deadline,
					nonce: Number(listing.nonce)
				};
				console.log("✅ Returning stored signature for listing", { tokenId: listing.token_id, seller: listing.seller_address });
				return new Response(
					JSON.stringify({ success: true, signature: listing.signature, transferData, timestamp: Math.floor(Date.now() / 1000) }),
					{ headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

		// Apply a purchase by reading the MarketplaceTransfer event from a tx hash
		if (url.pathname === "/apply-purchase" && req.method === "POST") {
			try {
				const body = await req.json() as any;
				const { txHash } = body;
				if (!txHash || typeof txHash !== "string") {
					return new Response(JSON.stringify({ error: "Missing or invalid txHash" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
				}

				// Fetch receipt
				const receipt = await withBackoff(() => provider.getTransactionReceipt(txHash));
				if (!receipt) {
					return new Response(JSON.stringify({ error: "Transaction receipt not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
				}

				// Parse logs for MarketplaceTransfer
				const iface = new ethers.Interface(PURCHASE_CONTRACT_ABI);
				let parsed: { from: string; to: string; tokenId: bigint; price: bigint } | null = null;
				for (const log of receipt.logs || []) {
					if (!log.address || log.address.toLowerCase() !== CROWN_PURCHASE_ADDRESS.toLowerCase()) continue;
					try {
						const pl = iface.parseLog({ topics: log.topics as string[], data: log.data as string });
						if (pl && pl.name === "MarketplaceTransfer") {
							const { from, to, tokenId, price } = pl.args as any;
							parsed = { from, to, tokenId: BigInt(tokenId), price: BigInt(price) };
							break;
						}
					} catch {}
				}

				if (!parsed) {
					return new Response(JSON.stringify({ error: "MarketplaceTransfer event not found in tx" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
				}

				const tokenIdStr = parsed.tokenId.toString();
				const newOwner = parsed.to;
				const oldOwner = parsed.from;

				// Ensure new owner exists
				await client.execute({ sql: "INSERT OR IGNORE INTO owners (address) VALUES (?)", args: [newOwner] });
				const ownerRow = await client.execute({ sql: "SELECT id FROM owners WHERE address = ?", args: [newOwner] });
				const newOwnerId = ownerRow.rows?.[0]?.id;
				if (!newOwnerId) {
					return new Response(JSON.stringify({ error: "Failed to resolve new owner in DB" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
				}

				// Upsert NFT and set owner
				await client.execute({
					sql: `INSERT INTO nfts (token_id, contract_address, owner_id)
					      VALUES (?, ?, ?)
					      ON CONFLICT(token_id) DO UPDATE SET owner_id = excluded.owner_id`,
					args: [tokenIdStr, CROWN_NFT_ADDRESS, newOwnerId]
				});

				// Deactivate listing by old owner if present
				await client.execute({
					sql: `UPDATE listings SET is_active = 0, updated_at = CURRENT_TIMESTAMP
					      WHERE token_id = ? AND contract_address = ? AND seller_address = ? AND is_active = 1`,
					args: [tokenIdStr, CROWN_NFT_ADDRESS, oldOwner]
				});

				return new Response(JSON.stringify({
					success: true,
					applied: {
						tokenId: tokenIdStr,
						from: oldOwner,
						to: newOwner,
						price: parsed.price.toString(),
						txHash
					}
				}), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
			} catch (error) {
				console.error("❌ Apply purchase failed:", error);
				return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
			}
		}

		// Generate counter signature endpoint
		if (url.pathname === "/generate-counter-signature" && req.method === "POST") {
			return new Promise((resolve) => {
				const mockRes = {
					status: (code: number) => ({
						json: (data: any) => {
							resolve(new Response(JSON.stringify(data), {
								status: code,
								headers: {
									"Content-Type": "application/json",
									...corsHeaders
								}
							}));
						}
					}),
					json: (data: any) => {
						resolve(new Response(JSON.stringify(data), {
							headers: {
								"Content-Type": "application/json",
								...corsHeaders
							}
						}));
					}
				};

				req.json().then((body: any) => {
					handleGenerateSignature({ body }, mockRes);
				}).catch((error: any) => {
					console.error("Counter signature request failed:", error);
					resolve(new Response(JSON.stringify({ error: "Invalid request body" }), {
						status: 400,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders
						}
					}));
				});
			});
		}

		// Sync past transfers to populate database
		if (url.pathname === "/sync") {
			try {
				const transferResult = await syncPastTransfers();
				const purchaseResult = await syncPastPurchases();
				const resaleResult = await syncPastMarketplaceTransfers();
				
				const totalEvents = transferResult.eventsProcessed + purchaseResult.eventsProcessed + resaleResult.eventsProcessed;
				
				return new Response(JSON.stringify({
					success: true,
					eventsProcessed: totalEvents,
					transferEvents: transferResult.eventsProcessed,
					purchaseEvents: purchaseResult.eventsProcessed,
					resaleEvents: resaleResult.eventsProcessed
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

		// Debug current listing row for a token
		if (url.pathname === "/debug-listing" && req.method === "GET") {
			try {
				const tokenId = url.searchParams.get("tokenId");
				const contractAddress = url.searchParams.get("contractAddress") || CROWN_NFT_ADDRESS;
				if (!tokenId) {
					return new Response(JSON.stringify({ error: "Missing tokenId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
				}
				const row = await client.execute({
					sql: `SELECT * FROM listings WHERE token_id = ? AND contract_address = ? ORDER BY created_at DESC LIMIT 1`,
					args: [tokenId.toString(), contractAddress]
				});
				return new Response(JSON.stringify({ listing: row.rows?.[0] || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
			} catch (e) {
				return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
console.log("  - CrownNFT V8:", CROWN_NFT_ADDRESS);
console.log("  - CrownPurchase V8:", CROWN_PURCHASE_ADDRESS);
console.log("  - DarkToken:", DARK_TOKEN_ADDRESS);

try {
	await syncPastTransfers();
	await syncPastPurchases();
	await syncPastMarketplaceTransfers();
	console.log("✅ Initial sync completed");
} catch (error) {
	console.error("❌ Initial sync failed:", error);
}

console.log("👂 Listening for Transfer events...");
console.log("💰 Listening for NFTPurchased events...");
console.log("🌐 Server running on http://localhost:3000");
