import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PurchaseLightModule = buildModule("PurchaseLightV10", (m) => {
	const lightNFT = m.contract("PurchaseLight", [
	]); // No constructor args

	return { lightNFT };
});

export default PurchaseLightModule;

// LightNFTModuleV4#LightNFT - 0xb6444082174b731bc5ae28DCdB1cf5d728d679E0
