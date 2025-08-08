import { ethers } from "hardhat";

const CROWN_NFT_V2_ADDRESS = "0x3Ec6a7B37f1142A5607E2299Ea00358dDEa864ab";
const CORRECT_SIGNER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Address from the private key

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Fixing authorized signer...");
    console.log("Deployer:", deployer.address);
    console.log("Setting authorized signer to:", CORRECT_SIGNER_ADDRESS);

    // Get contract instance
    const CrownNFT = await ethers.getContractAt("CrownNFTSimple", CROWN_NFT_V2_ADDRESS);

    // Check current authorized signer
    const currentSigner = await CrownNFT.authorizedSigner();
    console.log("Current authorized signer:", currentSigner);

    if (currentSigner.toLowerCase() === CORRECT_SIGNER_ADDRESS.toLowerCase()) {
        console.log("✅ Authorized signer is already correct!");
        return;
    }

    // Set the correct authorized signer
    console.log("Setting new authorized signer...");
    const tx = await CrownNFT.setAuthorizedSigner(CORRECT_SIGNER_ADDRESS);
    await tx.wait();
    
    console.log("✅ Authorized signer updated!");
    
    // Verify the change
    const newSigner = await CrownNFT.authorizedSigner();
    console.log("New authorized signer:", newSigner);
    console.log("Match:", newSigner.toLowerCase() === CORRECT_SIGNER_ADDRESS.toLowerCase());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 