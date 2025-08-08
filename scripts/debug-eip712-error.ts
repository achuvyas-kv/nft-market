import { ethers } from "hardhat";

const CROWN_NFT_V2_ADDRESS = "0x3Ec6a7B37f1142A5607E2299Ea00358dDEa864ab";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Debugging EIP712 transfer error...");
    console.log("Deployer:", deployer.address);

    // Test addresses from the error
    const fromAddress = "0x78C80D61acC3BD220e0561904835CB9ba825CfC8"; // Deployer
    const toAddress = "0x550Ab7ee806D941F878A7379261956DfC66fAaf6"; // Test user
    const tokenId = 2;

    // Get contract instance
    const CrownNFT = await ethers.getContractAt("CrownNFTSimple", CROWN_NFT_V2_ADDRESS);

    console.log("\n=== Contract State Check ===");
    
    // Check if token exists and who owns it
    try {
        const tokenOwner = await CrownNFT.ownerOf(tokenId);
        console.log(`Token ${tokenId} owner:`, tokenOwner);
        console.log(`Expected owner (from):`, fromAddress);
        console.log(`Ownership match:`, tokenOwner.toLowerCase() === fromAddress.toLowerCase());
    } catch (error) {
        console.log(`❌ Token ${tokenId} does not exist`);
        return;
    }

    // Check nonce
    const currentNonce = await CrownNFT.nonces(fromAddress);
    console.log(`Current nonce for ${fromAddress}:`, Number(currentNonce));

    // Check authorized signer
    const authorizedSigner = await CrownNFT.authorizedSigner();
    console.log("Authorized signer:", authorizedSigner);
    console.log("Deployer address:", deployer.address);
    console.log("Signer match:", authorizedSigner.toLowerCase() === deployer.address.toLowerCase());

    // Check domain separator
    const domainSeparator = await CrownNFT.getDomainSeparator();
    console.log("Contract domain separator:", domainSeparator);

    console.log("\n=== Testing Signature Generation ===");
    
    // Test signature generation with current state
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const price = ethers.parseUnits("10", 18).toString();
    
    try {
        const response = await fetch('http://localhost:3000/generate-transfer-signature', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: fromAddress,
                to: toAddress,
                tokenId: tokenId,
                price: price
            })
        });

        if (response.ok) {
            const signatureData = await response.json();
            console.log("✅ Backend signature generated:");
            console.log("- From:", signatureData.transferData.from);
            console.log("- To:", signatureData.transferData.to);
            console.log("- Token ID:", signatureData.transferData.tokenId);
            console.log("- Price:", signatureData.transferData.price);
            console.log("- Deadline:", signatureData.transferData.deadline);
            console.log("- Nonce:", signatureData.transferData.nonce);
            console.log("- Signature:", signatureData.signature);

            // Check if nonce matches
            console.log(`\nNonce comparison:`);
            console.log(`- Contract nonce: ${Number(currentNonce)}`);
            console.log(`- Signature nonce: ${signatureData.transferData.nonce}`);
            console.log(`- Match: ${Number(currentNonce) === signatureData.transferData.nonce}`);

            // Try to validate the signature on-chain
            console.log("\n=== On-chain Signature Validation ===");
            try {
                const transferHash = await CrownNFT.getTransferHash(
                    signatureData.transferData.from,
                    signatureData.transferData.to,
                    signatureData.transferData.tokenId,
                    signatureData.transferData.price,
                    signatureData.transferData.deadline,
                    signatureData.transferData.nonce
                );
                console.log("Contract transfer hash:", transferHash);

                // Try to recover the signer manually
                const domain = {
                    name: "CrownNFT",
                    version: "1",
                    chainId: 11155111,
                    verifyingContract: CROWN_NFT_V2_ADDRESS
                };

                const types = {
                    Transfer: [
                        { name: "from", type: "address" },
                        { name: "to", type: "address" },
                        { name: "tokenId", type: "uint256" },
                        { name: "price", type: "uint256" },
                        { name: "deadline", type: "uint256" },
                        { name: "nonce", type: "uint256" }
                    ]
                };

                const recoveredSigner = ethers.verifyTypedData(domain, types, signatureData.transferData, signatureData.signature);
                console.log("Recovered signer:", recoveredSigner);
                console.log("Expected signer:", authorizedSigner);
                console.log("Signature valid:", recoveredSigner.toLowerCase() === authorizedSigner.toLowerCase());

            } catch (error) {
                console.log("❌ On-chain validation failed:", error);
            }

        } else {
            const errorData = await response.json();
            console.log("❌ Backend signature failed:", errorData.error);
        }
    } catch (error) {
        console.log("❌ Error calling backend:", error);
    }

    console.log("\n=== Potential Issues ===");
    console.log("1. Check if token owner matches 'from' address");
    console.log("2. Check if nonce matches between contract and signature");
    console.log("3. Check if signature is valid");
    console.log("4. Check if deadline hasn't expired");
    console.log("5. Check if authorized signer is correct");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 