import { ethers } from "hardhat";

// Deployed addresses from CrownMarketplaceV4
const CROWN_NFT_ADDRESS = "0x602158126D46767D1e0B7eA91F246a1dbE06C71D"; // V5 Fixed Contract
const CROWN_PURCHASE_ADDRESS = "0x7836C0BD3A34Fc03415CCA04937f8c5E8c915FA3"; // V5 Fixed Contract
const DARK_TOKEN_ADDRESS = "0x9740D146D20FCF8643274cCD4Db91210200c9ed4";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing Crown Marketplace V4 with account:", deployer.address);

    // Get contract instances
    const CrownNFT = await ethers.getContractAt("CrownNFTSimple", CROWN_NFT_ADDRESS);
    const CrownPurchase = await ethers.getContractAt("CrownPurchase", CROWN_PURCHASE_ADDRESS);
    const DarkToken = await ethers.getContractAt("DarkToken", DARK_TOKEN_ADDRESS);

    console.log("\n=== Contract Addresses ===");
    console.log("CrownNFT (V4):", CROWN_NFT_ADDRESS);
    console.log("CrownPurchase (V4):", CROWN_PURCHASE_ADDRESS);
    console.log("DarkToken:", DARK_TOKEN_ADDRESS);

    // Check contract configurations
    console.log("\n=== Contract Information ===");
    
    // CrownNFT info
    const nftName = await CrownNFT.name();
    const nftSymbol = await CrownNFT.symbol();
    const nftOwner = await CrownNFT.owner();
    const nextTokenId = await CrownNFT.nextTokenId();
    
    console.log("CrownNFT Name:", nftName);
    console.log("CrownNFT Symbol:", nftSymbol);
    console.log("CrownNFT Owner:", nftOwner);
    console.log("Next Token ID:", nextTokenId.toString());
    
    // CrownPurchase info
    const purchaseOwner = await CrownPurchase.owner();
    const nftPrice = await CrownPurchase.getNFTPrice();
    const darkTokenAddr = await CrownPurchase.darkToken();
    const crownNFTAddr = await CrownPurchase.crownNFT();
    const authorizedSigner = await CrownPurchase.authorizedSigner();
    
    console.log("\nCrownPurchase Owner:", purchaseOwner);
    console.log("NFT Price:", ethers.formatEther(nftPrice), "DARK");
    console.log("Configured DarkToken:", darkTokenAddr);
    console.log("Configured CrownNFT:", crownNFTAddr);
    console.log("Authorized Signer:", authorizedSigner);
    
    // DarkToken info
    const darkName = await DarkToken.name();
    const darkSymbol = await DarkToken.symbol();
    const userBalance = await DarkToken.balanceOf(deployer.address);
    
    console.log("\nDarkToken Name:", darkName);
    console.log("DarkToken Symbol:", darkSymbol);
    console.log("User DARK Balance:", ethers.formatEther(userBalance));

    // Verify ownership setup
    console.log("\n=== Ownership Verification ===");
    const isOwnershipCorrect = nftOwner.toLowerCase() === CROWN_PURCHASE_ADDRESS.toLowerCase();
    console.log("✅ CrownNFT owned by CrownPurchase:", isOwnershipCorrect);
    
    const isTokenConfigCorrect = darkTokenAddr.toLowerCase() === DARK_TOKEN_ADDRESS.toLowerCase();
    console.log("✅ CrownPurchase configured with correct DarkToken:", isTokenConfigCorrect);
    
    const isNFTConfigCorrect = crownNFTAddr.toLowerCase() === CROWN_NFT_ADDRESS.toLowerCase();
    console.log("✅ CrownPurchase configured with correct CrownNFT:", isNFTConfigCorrect);

    // Test new functions (read-only)
    console.log("\n=== Testing New V4 Features ===");
    
    try {
        const domainSeparator = await CrownPurchase.getDomainSeparator();
        console.log("✅ EIP712 Domain Separator:", domainSeparator);
        
        const userNonce = await CrownPurchase.nonces(deployer.address);
        console.log("✅ User Nonce:", userNonce.toString());
        
        // Test getTransferHash function
        const testHash = await CrownPurchase.getTransferHash(
            deployer.address,
            "0x1234567890123456789012345678901234567890",
            1,
            ethers.parseEther("5"),
            Math.floor(Date.now() / 1000) + 3600,
            0
        );
        console.log("✅ Transfer Hash Generation:", testHash);
        
    } catch (error) {
        console.log("❌ Error testing new features:", error);
    }

    console.log("\n=== Deployment Summary ===");
    console.log("🎉 CrownMarketplace V4 successfully deployed!");
    console.log("📝 New Features Available:");
    console.log("   - Multiple NFT purchase (buyMultipleNFTs)");
    console.log("   - EIP712 signature-based transfers");
    console.log("   - Price management functions");
    console.log("   - Token withdrawal functionality");
    console.log("   - Improved error handling and events");
    console.log("   - Nonce-based replay attack prevention");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 