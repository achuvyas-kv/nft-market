import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LightTokenModule = buildModule("LightToken", (m) => {
	const lightToken = m.contract("LightToken", [
		100000
	]); // No constructor args

	return { lightToken };
});

export default LightTokenModule;


