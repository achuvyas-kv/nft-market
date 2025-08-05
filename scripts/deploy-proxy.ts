
// scripts/deployProxy.js
import { ethers, upgrades } from "hardhat";

async function main() {
	const LightNFT = await ethers.getContractFactory("LightNFT");
	const proxy = await upgrades.deployProxy(LightNFT, [
		"0x57FEFE88512863eE33d56AAB019ab9b24CB85417"
	], {
		initializer: "initialize",
		kind: "uups"
	});

	console.log("Proxy deployed to:", proxy.address);
}

main();
