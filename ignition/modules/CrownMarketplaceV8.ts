import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import DarkTokenModule from "./DarkToken";

const CrownMarketplaceV8Module = buildModule("CrownMarketplaceV8", (m) => {
  const { darkToken } = m.useModule(DarkTokenModule);

  const crownNFTSimple = m.contract("CrownNFTSimple");
  const crownPurchase = m.contract("CrownPurchase", [darkToken, crownNFTSimple]);

  m.call(crownNFTSimple, "transferOwnership", [crownPurchase]);

  return { crownNFTSimple, crownPurchase, darkToken };
});

export default CrownMarketplaceV8Module; 