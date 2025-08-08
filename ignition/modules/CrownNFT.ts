import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CrownNFTModule = buildModule("CrownNFTModule", (m) => {
  // Deploy the simple non-upgradeable version
  const crownNFT = m.contract("CrownNFTSimple");

  return { crownNFT };
});

export default CrownNFTModule; 