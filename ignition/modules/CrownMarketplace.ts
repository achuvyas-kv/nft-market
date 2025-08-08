import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import DarkTokenModule from "./DarkToken";
import CrownNFTModule from "./CrownNFT";
import CrownPurchaseModule from "./CrownPurchase";

const CrownMarketplaceModule = buildModule("CrownMarketplaceModule", (m) => {
  const { darkToken } = m.useModule(DarkTokenModule);
  const { crownNFT } = m.useModule(CrownNFTModule);
  const { crownPurchase } = m.useModule(CrownPurchaseModule);

  // Set the CrownPurchase contract as the owner of CrownNFT so it can mint
  m.call(crownNFT, "transferOwnership", [crownPurchase]);

  return { 
    darkToken, 
    crownNFT, 
    crownPurchase 
  };
});

export default CrownMarketplaceModule; 