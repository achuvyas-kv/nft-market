import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CompleteMarketplaceModule = buildModule("CompleteMarketplaceV1", (m) => {
	// Configuration
	const paymentToken = "0x46AB2cedc835Dd47a73590E132071c66fE75cAF6"; // STK token
	const authorizedSigner = "0x78C80D61acC3BD220e0561904835CB9ba825CfC8"; // Signer address
	const purchaseLightContract = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417"; // Existing PurchaseLight contract
	
	// Deploy LightNFT contract with PurchaseLight as authorized minter
	const lightNFT = m.contract("LightNFT", [purchaseLightContract]);
	
	// Deploy ResaleLight marketplace contract
	const resaleLight = m.contract("ResaleLight", [paymentToken, authorizedSigner]);

	return { 
		lightNFT, 
		resaleLight
	};
});

export default CompleteMarketplaceModule;

// Usage:
// npx hardhat ignition deploy ignition/modules/CompleteMarketplace.ts --network sepolia
// npx hardhat ignition deploy ignition/modules/CompleteMarketplace.ts --network localhost

// This will deploy:
// 1. LightNFT contract (for minting NFTs)
// 2. ResaleLight contract (for resale marketplace with EIP-712 signatures)
// 
// After deployment, update the frontend constants:
// - NFT_CONTRACT_ADDRESS with the deployed LightNFT address
// - RESALE_CONTRACT_ADDRESS with the deployed ResaleLight address 