import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LightNFTModule = buildModule("LightNFTModuleV2", (m) => {
	// Set PurchaseLight contract as the authorized minter
	const authorizedMinter = "0x57FEFE88512863eE33d56AAB019ab9b24CB85417";
	const lightNFT = m.contract("LightNFT", [authorizedMinter]);

	return { lightNFT };
});

export default LightNFTModule;

