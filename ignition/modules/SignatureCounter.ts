import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SignatureCounterModule = buildModule("SignatureCounterModule", (m) => {
  const signatureCounter = m.contract("SignatureCounter", []);

  return { signatureCounter };
});

export default SignatureCounterModule; 