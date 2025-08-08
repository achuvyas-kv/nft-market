// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

interface ICrownNFT {
    function mint(address to, string memory uri) external returns (uint256);

    function nextTokenId() external view returns (uint256);

    function marketplaceTransfer(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IERC1271 {
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) external view returns (bytes4);
}

contract CrownPurchase is Ownable, EIP712 {
    using ECDSA for bytes32;

    IERC20 public darkToken;
    ICrownNFT public crownNFT;

    uint256 public nftPrice = 10 * 10 ** 18; // 10 DARK tokens

    // EIP712 domain separator for marketplace transfers
    bytes32 private constant TRANSFER_TYPEHASH =
        keccak256(
            "Transfer(address from,address to,uint256 tokenId,uint256 price,uint256 deadline,uint256 nonce)"
        );

    // Nonces for each address to prevent replay attacks
    mapping(address => uint256) public nonces;

    // Authorized signer (admin) for off-chain signatures
    address public authorizedSigner;

    event NFTPurchased(
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 price
    );
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event MarketplaceTransfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId,
        uint256 price
    );

    constructor(
        address _darkToken,
        address _crownNFT
    ) Ownable(msg.sender) EIP712("CrownPurchase", "1") {
        darkToken = IERC20(_darkToken);
        crownNFT = ICrownNFT(_crownNFT);
        authorizedSigner = msg.sender; // Set deployer as initial authorized signer
    }

    function buyNFT(string memory tokenURI) external returns (uint256) {
        require(bytes(tokenURI).length > 0, "Token URI cannot be empty");

        // Check if user has enough DARK tokens
        require(
            darkToken.balanceOf(msg.sender) >= nftPrice,
            "Insufficient DARK token balance"
        );

        // Check if user has approved enough DARK tokens
        require(
            darkToken.allowance(msg.sender, address(this)) >= nftPrice,
            "Insufficient DARK token allowance"
        );

        // Transfer DARK tokens from buyer to this contract
        require(
            darkToken.transferFrom(msg.sender, address(this), nftPrice),
            "DARK token transfer failed"
        );

        // Mint NFT to buyer
        uint256 tokenId = crownNFT.mint(msg.sender, tokenURI);

        emit NFTPurchased(msg.sender, tokenId, nftPrice);

        return tokenId;
    }

    function buyMultipleNFTs(
        string[] memory tokenURIs
    ) external returns (uint256[] memory) {
        require(tokenURIs.length > 0, "Must provide at least one token URI");
        require(
            tokenURIs.length <= 10,
            "Cannot mint more than 10 NFTs at once"
        );

        uint256 totalCost = nftPrice * tokenURIs.length;

        // Check if user has enough DARK tokens
        require(
            darkToken.balanceOf(msg.sender) >= totalCost,
            "Insufficient DARK token balance"
        );

        // Check if user has approved enough DARK tokens
        require(
            darkToken.allowance(msg.sender, address(this)) >= totalCost,
            "Insufficient DARK token allowance"
        );

        // Transfer DARK tokens from buyer to this contract
        require(
            darkToken.transferFrom(msg.sender, address(this), totalCost),
            "DARK token transfer failed"
        );

        // Mint NFTs to buyer
        uint256[] memory tokenIds = new uint256[](tokenURIs.length);
        for (uint256 i = 0; i < tokenURIs.length; i++) {
            require(
                bytes(tokenURIs[i]).length > 0,
                "Token URI cannot be empty"
            );
            uint256 tokenId = crownNFT.mint(msg.sender, tokenURIs[i]);
            tokenIds[i] = tokenId;
            emit NFTPurchased(msg.sender, tokenId, nftPrice);
        }

        return tokenIds;
    }

    // Transfer NFT using EIP712 signature (for marketplace sales)
    function transferWithSignature(
        address from,
        address to,
        uint256 tokenId,
        uint256 price,
        uint256 deadline,
        uint256 nonce,
        bytes memory signature
    ) external payable {
        require(block.timestamp <= deadline, "Signature expired");
        require(nonce == nonces[from], "Invalid nonce");
        require(crownNFT.ownerOf(tokenId) == from, "Not token owner");
        require(to != address(0), "Invalid recipient");

        // Verify EIP712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_TYPEHASH,
                from,
                to,
                tokenId,
                price,
                deadline,
                nonce
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address tokenOwner = crownNFT.ownerOf(tokenId);

        if (tokenOwner.code.length > 0) {
            // Token owner is a smart contract, use EIP-1271
            require(
                IERC1271(tokenOwner).isValidSignature(hash, signature) ==
                    0x1626ba7e,
                "Invalid smart wallet signature"
            );
        } else {
            // Token owner is an EOA, use standard signature verification
            address signer = hash.recover(signature);
            require(signer == tokenOwner, "Invalid signature");
        }

        // Increment nonce to prevent replay
        nonces[from]++;

        // Transfer DARK tokens from buyer to seller
        if (price > 0) {
            require(
                darkToken.balanceOf(msg.sender) >= price,
                "Insufficient DARK token balance"
            );
            require(
                darkToken.allowance(msg.sender, address(this)) >= price,
                "Insufficient DARK token allowance"
            );
            require(
                darkToken.transferFrom(msg.sender, from, price),
                "DARK token transfer failed"
            );
        }

        // Transfer the NFT through marketplace contract
        crownNFT.marketplaceTransfer(from, to, tokenId);

        emit MarketplaceTransfer(from, to, tokenId, price);
    }

    // Set authorized signer for off-chain transfers
    function setAuthorizedSigner(address _signer) external onlyOwner {
        authorizedSigner = _signer;
    }

    // Get the domain separator for EIP712
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // Helper function to get the typed data hash for off-chain signing
    function getTransferHash(
        address from,
        address to,
        uint256 tokenId,
        uint256 price,
        uint256 deadline,
        uint256 nonce
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_TYPEHASH,
                from,
                to,
                tokenId,
                price,
                deadline,
                nonce
            )
        );

        return _hashTypedDataV4(structHash);
    }

    function setNFTPrice(uint256 _newPrice) external onlyOwner {
        require(_newPrice > 0, "Price must be greater than 0");
        uint256 oldPrice = nftPrice;
        nftPrice = _newPrice;
        emit PriceUpdated(oldPrice, _newPrice);
    }

    function setDarkToken(address _darkToken) external onlyOwner {
        require(_darkToken != address(0), "Invalid token address");
        darkToken = IERC20(_darkToken);
    }

    function setCrownNFT(address _crownNFT) external onlyOwner {
        require(_crownNFT != address(0), "Invalid NFT address");
        crownNFT = ICrownNFT(_crownNFT);
    }

    function withdrawDarkTokens() external onlyOwner {
        uint256 balance = darkToken.balanceOf(address(this));
        require(balance > 0, "No DARK tokens to withdraw");
        require(darkToken.transfer(owner(), balance), "Transfer failed");
    }

    function getNFTPrice() external view returns (uint256) {
        return nftPrice;
    }

    function getNextTokenId() external view returns (uint256) {
        return crownNFT.nextTokenId();
    }
}
