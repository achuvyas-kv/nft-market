import { ethers } from "ethers";

// Configuration matching our contract
const SIGNER_PRIVATE_KEY = "e8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a";
const PURCHASE_CONTRACT_ADDRESS = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417";
const TOKEN_PRICE = "1000000000000000000";
const USER_ADDRESS = "0x0A9d01A55Dd5b44Ed5AA6Be4667d62a7dFf52a01";
const NONCE = 0;

// Create signer
const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);

async function debugSignature() {
    console.log("🔍 Debugging Signature Generation");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("User Address:", USER_ADDRESS);
    console.log("Token Price:", TOKEN_PRICE);
    console.log("Contract Address:", PURCHASE_CONTRACT_ADDRESS);
    console.log("Nonce:", NONCE);
    console.log("Signer Address:", signer.address);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Method 1: Using solidityPackedKeccak256 (current method)
    console.log("\n📝 Method 1: solidityPackedKeccak256");
    const messageHash1 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "address", "uint256"],
        [USER_ADDRESS, TOKEN_PRICE, PURCHASE_CONTRACT_ADDRESS, NONCE]
    );
    console.log("Message Hash:", messageHash1);

    // Method 2: Manual abi.encodePacked equivalent
    console.log("\n📝 Method 2: Manual encodePacked");
    const packed = ethers.concat([
        ethers.getBytes(ethers.zeroPadValue(USER_ADDRESS, 32).slice(12)), // address (20 bytes)
        ethers.getBytes(ethers.zeroPadValue(ethers.toBeHex(TOKEN_PRICE), 32)), // uint256 (32 bytes)
        ethers.getBytes(ethers.zeroPadValue(PURCHASE_CONTRACT_ADDRESS, 32).slice(12)), // address (20 bytes)
        ethers.getBytes(ethers.zeroPadValue(ethers.toBeHex(NONCE), 32)) // uint256 (32 bytes)
    ]);
    const messageHash2 = ethers.keccak256(packed);
    console.log("Message Hash:", messageHash2);

    console.log("\n🔍 Hash Comparison:");
    console.log("Method 1 === Method 2:", messageHash1 === messageHash2);

    // Generate signature using Method 1 (our current approach)
    console.log("\n🔐 Signature Generation:");
    const signature = await signer.signMessage(ethers.getBytes(messageHash1));
    console.log("Generated Signature:", signature);

    // Verify signature
    console.log("\n✅ Signature Verification:");
    const ethSignedMessageHash = ethers.hashMessage(ethers.getBytes(messageHash1));
    console.log("Eth Signed Message Hash:", ethSignedMessageHash);
    
    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash1), signature);
    console.log("Recovered Address:", recoveredAddress);
    console.log("Expected Signer:", signer.address);
    console.log("Signature Valid:", recoveredAddress.toLowerCase() === signer.address.toLowerCase());

    // Test what the contract would see
    console.log("\n🏗️ Contract Verification Simulation:");
    try {
        const recoveredFromSignature = ethers.recoverAddress(ethSignedMessageHash, signature);
        console.log("Contract would recover:", recoveredFromSignature);
        console.log("Contract verification would pass:", recoveredFromSignature.toLowerCase() === signer.address.toLowerCase());
    } catch (err) {
        console.error("Contract verification error:", err);
    }

    return {
        messageHash: messageHash1,
        signature,
        recoveredAddress,
        expectedSigner: signer.address
    };
}

debugSignature().catch(console.error); 