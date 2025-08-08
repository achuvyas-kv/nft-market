import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DarkTokenModule = buildModule("DarkTokenModule", (m) => {
  const darkToken = m.contract("DarkToken");

  return { darkToken };
});

export default DarkTokenModule; 