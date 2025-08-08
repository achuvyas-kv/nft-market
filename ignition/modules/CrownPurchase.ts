import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import DarkTokenModule from "./DarkToken";
import CrownNFTModule from "./CrownNFT";

const CrownPurchaseModule = buildModule("CrownPurchaseModule", (m) => {
  const { darkToken } = m.useModule(DarkTokenModule);
  const { crownNFT } = m.useModule(CrownNFTModule);

  const crownPurchase = m.contract("CrownPurchase", [darkToken, crownNFT]);

  return { crownPurchase };
});

export default CrownPurchaseModule; 