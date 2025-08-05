// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract LightNFT is
    Initializable,
    ERC721Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    uint public nextTokenId;
    uint public mintPrice;
    address public authorizedMinter;

    mapping(uint => string) private _tokenURIs;

    modifier onlyMinter() {
        require(msg.sender == authorizedMinter, "Not authorized");
        _;
    }

    function initialize(address _authorizedMinter) public initializer {
        __ERC721_init("LightNFT", "LNFT");
        __Ownable_init();
        __UUPSUpgradeable_init();

        authorizedMinter = _authorizedMinter;
        mintPrice = 0.005 ether;
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

    // Required for UUPS
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
