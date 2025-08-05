import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LightNFTModule = buildModule("LightNFTModuleV6", (m) => {
	const lightNFT = m.contract("LightNFT", ["0x73C89e6872D58ed2f4733E83BF36810CF3DEc885"]); // No constructor args

	return { lightNFT };
});

export default LightNFTModule;

// LightNFTModuleV4#LightNFT - 0xb6444082174b731bc5ae28DCdB1cf5d728d679E0
// PurchaseLightV3#PurchaseLight - 0x70242358377E908CBA77013e64Fa215afFb06774
//lightv5--0xb99DaD1c9469d6E695ea89C4043FEf0b5bAEd9fc
