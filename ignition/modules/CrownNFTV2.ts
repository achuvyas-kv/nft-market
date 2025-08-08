import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CrownNFTV2Module = buildModule("CrownNFTV2Module", (m) => {
  // Deploy the updated CrownNFT contract with EIP712 functionality
  const crownNFTV2 = m.contract("CrownNFTSimple");

  return { crownNFTV2 };
});

export default CrownNFTV2Module; 