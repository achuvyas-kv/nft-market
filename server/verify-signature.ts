import { ethers } from "ethers";

// Configuration
const SIGNER_PRIVATE_KEY = "e8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a";
const PURCHASE_CONTRACT_ADDRESS = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417";
const TOKEN_PRICE = "1000000000000000000";
const USER_ADDRESS = "0x0A9d01A55Dd5b44Ed5AA6Be4667d62a7dFf52a01";
const NONCE = 0;

const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);

async function verifySignature() {
    console.log("🔍 Signature Verification Test");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Generate message hash exactly as our contract does
    const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "address", "uint256"],
        [USER_ADDRESS, TOKEN_PRICE, PURCHASE_CONTRACT_ADDRESS, NONCE]
    );
    
    console.log("Parameters:");
    console.log("  User:", USER_ADDRESS);
    console.log("  Price:", TOKEN_PRICE);
    console.log("  Contract:", PURCHASE_CONTRACT_ADDRESS);
    console.log("  Nonce:", NONCE);
    console.log("  Signer:", signer.address);
    console.log("");
    console.log("Message Hash:", messageHash);
    
    // Sign the message
    const signature = await signer.signMessage(ethers.getBytes(messageHash));
    console.log("Signature:", signature);
    
    // Verify using ethers (this simulates frontend verification)
    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
    console.log("");
    console.log("Frontend Verification:");
    console.log("  Recovered Address:", recoveredAddress);
    console.log("  Expected Signer:", signer.address);
    console.log("  ✅ Match:", recoveredAddress.toLowerCase() === signer.address.toLowerCase());
    
    return {
        messageHash,
        signature,
        isValid: recoveredAddress.toLowerCase() === signer.address.toLowerCase()
    };
}

if (import.meta.main) {
    verifySignature().then(result => {
        if (result.isValid) {
            console.log("\n🎉 Signature generation is working correctly!");
            console.log("The issue must be elsewhere...");
        } else {
            console.log("\n❌ Signature generation has an issue!");
        }
    }).catch(console.error);
} 