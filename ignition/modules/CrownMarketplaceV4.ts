import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import DarkTokenModule from "./DarkToken";

const CrownMarketplaceV4Module = buildModule("CrownMarketplaceV4", (m) => {
  // Use existing DarkToken deployment
  const { darkToken } = m.useModule(DarkTokenModule);

  // Deploy the CrownNFTSimple contract (clean NFT contract without EIP712)
  const crownNFTSimple = m.contract("CrownNFTSimple");

  // Deploy the updated CrownPurchase contract (with EIP712 marketplace logic and new features)
  const crownPurchase = m.contract("CrownPurchase", [darkToken, crownNFTSimple]);

  // Set CrownPurchase as owner of CrownNFTSimple so it can mint and transfer
  m.call(crownNFTSimple, "transferOwnership", [crownPurchase]);

  return { 
    crownNFTSimple, 
    crownPurchase,
    darkToken 
  };
});

export default CrownMarketplaceV4Module;

// Usage:
// npx hardhat ignition deploy ignition/modules/CrownMarketplaceV4.ts --network sepolia
// 
// Updated Features in CrownPurchase:
// - Multiple NFT purchase (buyMultipleNFTs)
// - EIP712 signature-based transfers for marketplace
// - Price management functions (setNFTPrice)
// - Token and NFT contract management (setDarkToken, setCrownNFT)
// - Token withdrawal functionality (withdrawDarkTokens)
// - Authorized signer management (setAuthorizedSigner)
// - Improved error handling and events
// - Nonce-based replay attack prevention 