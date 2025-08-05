// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface ILightNFT {
    function mint(address recipient, string memory _uri) external;
}

contract PurchaseLight {
    IERC20 public paymentToken =
        IERC20(0x46AB2cedc835Dd47a73590E132071c66fE75cAF6);
    ILightNFT public nft;

    uint public tokenPrice = 1 * 10 ** 18;
    address public owner;
    address public signer; // Whitelisted signer address

    mapping(address => uint256) public nonces; // Per-user nonce for replay protection

    constructor() {
        owner = msg.sender;
        signer = msg.sender;
    }

    // Main function to buy NFT using ERC20 token
    function buyNFT(string memory _uri, bytes memory _signature) external {
        require(
            paymentToken.allowance(msg.sender, address(this)) >= tokenPrice,
            "Not enough allowance"
        );
        require(
            paymentToken.balanceOf(msg.sender) >= tokenPrice,
            "Not enough token balance"
        );

        uint256 currentNonce = nonces[msg.sender];

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                tokenPrice,
                address(this),
                currentNonce
            )
        );

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        require(
            ECDSA.recover(ethSignedMessageHash, _signature) == signer,
            "Invalid signature"
        );

        nonces[msg.sender]++;

        bool success = paymentToken.transferFrom(
            msg.sender,
            address(this),
            tokenPrice
        );
        require(success, "ERC20 transferFrom failed");

        nft.mint(msg.sender, _uri);
    }

    // Set NFT contract address
    function setNftContract(address _nftAddress) external {
        require(msg.sender == owner, "Only owner can set NFT contract");
        nft = ILightNFT(_nftAddress);
    }

    // Set the whitelisting signer
    function setSigner(address _signer) external {
        require(msg.sender == owner, "Only owner can set signer");
        signer = _signer;
    }

    // Allow owner to update token price
    function setTokenPrice(uint _price) external {
        require(msg.sender == owner, "Only owner can set price");
        tokenPrice = _price;
    }
}
