import { createClient } from "@libsql/client";
import { serve } from "bun";
import { ethers } from "ethers";
const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";

const CONTRACT_ADDRESS = "0xC5D0A854Da8b2231A44969c5e4c1C4Fc4C229997";
const CONTRACT_ABI = [
	"event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const client = createClient({
	authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTM4NTYxMDksImlkIjoiYWE0NmIyMTUtZTViYS00MzFmLWFlYzItYjk2NDlhOGExOWY0IiwicmlkIjoiZWM5Nzg4ODUtNDk0OC00YWQ5LTk2MjUtMzMzNDBlOTZhYWMyIn0.Mlp_hoVmHvRZ2t_MoAmIwzt2cBCzbgs92pHWOMkoAJoYUio1JvEiA6uyHuhEsQM7l25m6E5Tg51gmjtnLFnaCQ",       // Replace with your DB URL
	url: "libsql://nft-test-achuvyas-kv.aws-ap-south-1.turso.io",           // Replace with your auth token if needed
});

const provider = new ethers.JsonRpcProvider(INFURA_URL);


const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);



// Your schema as a single string
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
`;

// Split and run each SQL statement separately
await client.batch(
	schema
		.split(";")
		.map(stmt => stmt.trim())
		.filter(Boolean)
		.map(sql => ({ sql }))
);

console.log("✅ Tables created.");

contract.on("Transfer", async (from, to, tokenId, event) => {
	console.log("🔔 NFTMinted Event:");
	console.log("To: ", to);
	console.log("Token ID: ", tokenId.toString());
	console.log("URI: ", from);
	try {
		// Step 1: Ensure new owner exists
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

		// Step 3: Check if NFT exists
		const nftResult = await client.execute({
			sql: "SELECT id FROM nfts WHERE token_id = ? AND contract_address = ?",
			args: [tokenId.toString(), CONTRACT_ADDRESS],
		});

		if (nftResult.rows.length === 0) {
			// Step 4a: Create new NFT
			await client.execute({
				sql: "INSERT INTO nfts (token_id, contract_address, metadata_uri, owner_id) VALUES (?, ?, NULL, ?)",
				args: [tokenId.toString(), CONTRACT_ADDRESS, ownerId],
			});
			console.log("✅ New NFT inserted");
		} else {
			// Step 4b: Update ownership of existing NFT
			await client.execute({
				sql: "UPDATE nfts SET owner_id = ? WHERE token_id = ? AND contract_address = ?",
				args: [ownerId, tokenId.toString(), CONTRACT_ADDRESS],
			});
		}

	} catch (e) {
		console.log(e)

	}


});


async function syncPastTransfers() {
	const fromBlock = 0; // or earliest relevant block
	const toBlock = "latest";

	const events = await contract.queryFilter("Transfer", fromBlock, toBlock);

	for (const event of events) {
		const { from, to, tokenId } = event.args;

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
			args: [tokenId.toString(), CONTRACT_ADDRESS, ownerId],
		});
	}


	return { success: true, eventsProcessed: events.length };
}

















//
// console.log("👂 Listening for NFTMinted events...");
//
//
// eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTM4NTYxMDksImlkIjoiYWE0NmIyMTUtZTViYS00MzFmLWFlYzItYjk2NDlhOGExOWY0IiwicmlkIjoiZWM5Nzg4ODUtNDk0OC00YWQ5LTk2MjUtMzMzNDBlOTZhYWMyIn0.Mlp_hoVmHvRZ2t_MoAmIwzt2cBCzbgs92pHWOMkoAJoYUio1JvEiA6uyHuhEsQM7l25m6E5Tg51gmjtnLFnaCQ
//
// libsql://nft-test-achuvyas-kv.aws-ap-south-1.turso.io
//
//

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

serve({
	port: 3000,
	async fetch(req) {
		const url = new URL(req.url);

		// Handle CORS preflight
		if (req.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		// GET /nfts?owner=0x123...
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
				sql: `SELECT token_id, contract_address, metadata_uri, created_at FROM nfts WHERE owner_id = ?`,
				args: [ownerId],
			});

			return new Response(JSON.stringify(nftsResult.rows), {
				headers: { "Content-Type": "application/json", ...corsHeaders },
			});
		}

		// Optional: Keep your /sync route
		if (url.pathname === "/sync") {
			const result = await syncPastTransfers();
			return new Response(JSON.stringify(result), {
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
