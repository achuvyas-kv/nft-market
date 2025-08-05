import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

const config: HardhatUserConfig = {
	solidity: "0.8.28",
	networks: {
		sepolia: {
			url: "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2",
			accounts: ["e8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a"], // never commit this
		},
		polygon: {
			url: "https://polygon-amoy.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2",
			accounts: ["d21736cfb447af86767787ca8edc0da257118f86be7138a603d1fcb92c4f914a"], // never commit this
		}
	},
};

export default config;

// LightNFTModule#LightNFT - 0xD445899d3Eb14D6Bb65fFaDD076c679422D011Cf
// achuvyas@ll-kv-achu:~/Developer/nft-market $
//
//
//
//
//
// Deploying [ LightNFTModuleV2 ]
//
// Warning - previously executed futures are not in the module:
//  - LightNFTModule#LightNFT
//
// Batch #1
//   Executed LightNFTModuleV2#LightNFT
//
// [ LightNFTModuleV2 ] successfully deployed 🚀
//
// Deployed Addresses
//
// LightNFTModule#LightNFT - 0xD445899d3Eb14D6Bb65fFaDD076c679422D011Cf
// LightNFTModuleV2#LightNFT - 0xd317fb52b308D3C42968e584B1757623DB4e19a6
// achuvyas@ll-kv-achu:~/Developer/nft-market $
//
//
// science cube receive renew leopard face where decide blossom velvet there spawn
//
//
// polygon
// LightNFTModuleV2#LightNFT - 0xD445899d3Eb14D6Bb65fFaDD076c679422D011Cf
//
//
//LightNFTModuleV3#LightNFT - 0xcB0848da43653BC9AA5E4ac9B5957026C2605B43
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//PurchaseLight#PurchaseLight - 0xD9b630E025CAd179c1969caad74B870E7E81Cb4E
//
