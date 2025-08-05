import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const StartTokenModule = buildModule("StarToken", (m) => {
	const starToken = m.contract("StarToken", [
		100000
	]); // No constructor args

	return { starToken };
});

export default StartTokenModule;


