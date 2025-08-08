import { ethers } from "hardhat";

const CROWN_NFT_ADDRESS = "0x602158126D46767D1e0B7eA91F246a1dbE06C71D"; // V5 Fixed Contract
const CROWN_PURCHASE_ADDRESS = "0x7836C0BD3A34Fc03415CCA04937f8c5E8c915FA3"; // V5 Fixed Contract
const DARK_TOKEN_ADDRESS = "0x9740D146D20FCF8643274cCD4Db91210200c9ed4";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Setting up Crown Marketplace with account:", deployer.address);

    // Get contract instances
    const CrownNFT = await ethers.getContractAt("CrownNFTSimple", CROWN_NFT_ADDRESS);
    const CrownPurchase = await ethers.getContractAt("CrownPurchase", CROWN_PURCHASE_ADDRESS);
    const DarkToken = await ethers.getContractAt("DarkToken", DARK_TOKEN_ADDRESS);

    console.log("\n=== Contract Addresses ===");
    console.log("CrownNFT:", CROWN_NFT_ADDRESS);
    console.log("CrownPurchase:", CROWN_PURCHASE_ADDRESS);
    console.log("DarkToken:", DARK_TOKEN_ADDRESS);

    // Check current owner of CrownNFT
    const currentOwner = await CrownNFT.owner();
    console.log("\nCurrent CrownNFT owner:", currentOwner);
    console.log("Deployer address:", deployer.address);
    console.log("CrownPurchase address:", CROWN_PURCHASE_ADDRESS);

    // Transfer ownership of CrownNFT to CrownPurchase contract
    if (currentOwner.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("\nTransferring CrownNFT ownership to CrownPurchase contract...");
        const tx = await CrownNFT.transferOwnership(CROWN_PURCHASE_ADDRESS);
        await tx.wait();
        console.log("✅ Ownership transferred successfully!");
        
        // Verify the transfer
        const newOwner = await CrownNFT.owner();
        console.log("New CrownNFT owner:", newOwner);
    } else {
        console.log("⚠️  CrownNFT is not owned by deployer, skipping ownership transfer");
    }

    // Check contract configurations
    console.log("\n=== Contract Information ===");
    
    // DarkToken info
    const darkName = await DarkToken.name();
    const darkSymbol = await DarkToken.symbol();
    const darkDecimals = await DarkToken.decimals();
    const darkTotalSupply = await DarkToken.totalSupply();
    console.log(`DarkToken: ${darkName} (${darkSymbol}) - ${darkDecimals} decimals`);
    console.log(`Total Supply: ${ethers.formatUnits(darkTotalSupply, darkDecimals)} ${darkSymbol}`);

    // CrownNFT info
    const nftName = await CrownNFT.name();
    const nftSymbol = await CrownNFT.symbol();
    const nextTokenId = await CrownNFT.nextTokenId();
    console.log(`CrownNFT: ${nftName} (${nftSymbol})`);
    console.log(`Next Token ID: ${nextTokenId}`);

    // CrownPurchase info
    const nftPrice = await CrownPurchase.getNFTPrice();
    console.log(`NFT Price: ${ethers.formatUnits(nftPrice, 18)} DARK tokens`);

    // Send some DARK tokens to deployer for testing
    const deployerBalance = await DarkToken.balanceOf(deployer.address);
    console.log(`\nDeployer DARK balance: ${ethers.formatUnits(deployerBalance, 18)} DARK`);

    if (deployerBalance > 0) {
        console.log("✅ Setup complete! You can now test the marketplace.");
        console.log("\nTo test:");
        console.log("1. Approve DARK tokens for CrownPurchase contract");
        console.log("2. Call buyNFT on CrownPurchase contract");
    } else {
        console.log("⚠️  No DARK tokens in deployer account. You may need to mint some for testing.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 