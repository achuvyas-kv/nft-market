import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import DarkTokenModule from "./DarkToken";

const CrownMarketplaceV5Module = buildModule("CrownMarketplaceV5", (m) => {
  // Use existing DarkToken deployment
  const { darkToken } = m.useModule(DarkTokenModule);

  // Deploy the CrownNFTSimple contract (clean NFT contract without EIP712)
  const crownNFTSimple = m.contract("CrownNFTSimple");

  // Deploy the FIXED CrownPurchase contract (with corrected EIP712 signature verification)
  const crownPurchase = m.contract("CrownPurchase", [darkToken, crownNFTSimple]);

  // Set CrownPurchase as owner of CrownNFTSimple so it can mint and transfer
  m.call(crownNFTSimple, "transferOwnership", [crownPurchase]);

  return { 
    crownNFTSimple, 
    crownPurchase,
    darkToken 
  };
});

export default CrownMarketplaceV5Module;

// Usage:
// npx hardhat ignition deploy ignition/modules/CrownMarketplaceV5.ts --network sepolia

// Fixed Features in CrownPurchase V5:
// - ✅ Corrected smart contract wallet signature verification logic
// - ✅ Proper EIP-1271 validation for smart wallets
// - ✅ Fixed token owner vs signer address validation
// - ✅ Enhanced security for marketplace transfers 