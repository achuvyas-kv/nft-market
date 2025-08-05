// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract LightNFT is ERC721 {
    uint public nextTokenId;
    uint public mintPrice = 0.005 ether;
    address public authorizedMinter;

    mapping(uint => string) private _tokenURIs;

    constructor(address _authorizedMinter) ERC721("LightNFT", "LNFT") {
        authorizedMinter = _authorizedMinter;
    }

    modifier onlyMinter() {
        require(msg.sender == authorizedMinter, "Not authorized");
        _;
    }

    function mint(address recipient, string memory _uri) external onlyMinter {
        uint tokenId = nextTokenId;
        _safeMint(recipient, tokenId);
        _setTokenUri(tokenId, _uri);
        nextTokenId++;
    }

    function _setTokenUri(uint tokenId, string memory _uri) internal {
        _tokenURIs[tokenId] = _uri;
    }

    function tokenURI(
        uint tokenId
    ) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }
}
