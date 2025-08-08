// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CrownNFTSimple is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    constructor() ERC721("Crown NFT", "CROWN") Ownable(msg.sender) {
        _nextTokenId = 1; // Start token IDs from 1
    }

    function mint(address to, string memory uri) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    function mintBatch(address to, string[] memory uris) public onlyOwner returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](uris.length);
        
        for (uint256 i = 0; i < uris.length; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, uris[i]);
            tokenIds[i] = tokenId;
        }
        
        return tokenIds;
    }

    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }

    function nextTokenId() public view returns (uint256) {
        return _nextTokenId;
    }

    // Allow marketplace contract to transfer NFTs
    function marketplaceTransfer(address from, address to, uint256 tokenId) external onlyOwner {
        require(ownerOf(tokenId) == from, "Not token owner");
        require(to != address(0), "Invalid recipient");
        _transfer(from, to, tokenId);
    }

    // The following functions are overrides required by Solidity.
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
} 