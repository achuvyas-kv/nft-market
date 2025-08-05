
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("LightNFT", function() {
	async function deployNFTFixture() {
		const [owner, otherUser] = await ethers.getSigners();
		const mintPrice = ethers.parseEther("0.01");

		const LightNFT = await ethers.getContractFactory("LightNFT");
		const nft = await LightNFT.deploy();

		return { nft, owner, otherUser, mintPrice };
	}

	describe("Deployment", function() {
		it("Should set the correct name and symbol", async function() {
			const { nft } = await loadFixture(deployNFTFixture);
			expect(await nft.name()).to.equal("LightNFT");
			expect(await nft.symbol()).to.equal("LNFT");
		});

		it("Should start with tokenId 0", async function() {
			const { nft } = await loadFixture(deployNFTFixture);
			expect(await nft.nextTokenId()).to.equal(0);
		});
	});

	describe("Minting", function() {
		it("Should mint an NFT when paid enough", async function() {
			const { nft, owner, mintPrice } = await loadFixture(deployNFTFixture);
			const uri = "https://example.com/metadata/0.json";

			await expect(nft.connect(owner).mint(uri, { value: mintPrice }))
				.to.emit(nft, "Transfer")
				.withArgs(ethers.ZeroAddress, owner.address, 0);

			expect(await nft.ownerOf(0)).to.equal(owner.address);
			expect(await nft.tokenURI(0)).to.equal(uri);
			expect(await nft.nextTokenId()).to.equal(1);
		});

		it("Should fail if payment is insufficient", async function() {
			const { nft, otherUser } = await loadFixture(deployNFTFixture);
			const uri = "https://example.com/metadata/1.json";

			await expect(
				nft.connect(otherUser).mint(uri, { value: ethers.parseEther("0.001") })
			).to.be.revertedWith("Gimme money to mint");
		});

		it("Should allow multiple mints with unique URIs", async function() {
			const { nft, owner, mintPrice } = await loadFixture(deployNFTFixture);

			await nft.mint("https://example.com/metadata/0.json", { value: mintPrice });
			await nft.mint("https://example.com/metadata/1.json", { value: mintPrice });

			expect(await nft.tokenURI(0)).to.equal("https://example.com/metadata/0.json");
			expect(await nft.tokenURI(1)).to.equal("https://example.com/metadata/1.json");
		});
	});
});


