import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import DarkTokenModule from "./DarkToken";

const CrownMarketplaceV6Module = buildModule("CrownMarketplaceV6", (m) => {
  // Use existing DarkToken deployment
  const { darkToken } = m.useModule(DarkTokenModule);

  // Deploy the CrownNFTSimple contract
  const crownNFTSimple = m.contract("CrownNFTSimple");

  // Deploy the updated CrownPurchase contract (buyer-agnostic EIP-712: no 'to' in struct)
  const crownPurchase = m.contract("CrownPurchase", [darkToken, crownNFTSimple]);

  // Set CrownPurchase as owner of CrownNFTSimple so it can mint and transfer
  m.call(crownNFTSimple, "transferOwnership", [crownPurchase]);

  return {
    crownNFTSimple,
    crownPurchase,
    darkToken,
  };
});

export default CrownMarketplaceV6Module; 