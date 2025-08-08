import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import DarkTokenModule from "./DarkToken";

const CrownMarketplaceV3Module = buildModule("CrownMarketplaceV3", (m) => {
  // Use existing DarkToken deployment
  const { darkToken } = m.useModule(DarkTokenModule);

  // Deploy the updated CrownNFTSimple contract (clean NFT contract without EIP712)
  const crownNFTSimple = m.contract("CrownNFTSimple");

  // Deploy the updated CrownPurchase contract (with EIP712 marketplace logic)
  const crownPurchase = m.contract("CrownPurchase", [darkToken, crownNFTSimple]);

  // Set CrownPurchase as owner of CrownNFTSimple so it can mint and transfer
  m.call(crownNFTSimple, "transferOwnership", [crownPurchase]);

  return { 
    crownNFTSimple, 
    crownPurchase,
    darkToken 
  };
});

export default CrownMarketplaceV3Module;

// Usage:
// npx hardhat ignition deploy ignition/modules/CrownMarketplaceV3.ts --network sepolia 