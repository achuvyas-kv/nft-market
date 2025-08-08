// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract ResaleLight is EIP712 {
    IERC20 public paymentToken;
    address public owner;
    address public authorizedSigner;
    uint256 public platformFeePercentage = 250; // 2.5% (250 basis points)
    
    mapping(address => uint256) public nonces; // Per-user nonce for replay protection
    mapping(bytes32 => bool) public usedSignatures; // Prevent signature replay
    
    // EIP-712 type hash for ResaleListing struct
    bytes32 private constant LISTING_TYPEHASH = 
        keccak256("ResaleListing(address seller,address nftContract,uint256 tokenId,uint256 price,uint256 deadline,uint256 nonce)");
    
    // Struct for EIP-712 signed resale listing
    struct ResaleListing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        uint256 deadline;
        uint256 nonce;
    }
    
    event NFTResold(
        address indexed seller,
        address indexed buyer,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price,
        uint256 platformFee
    );
    
    event ListingCancelled(
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 nonce
    );
    
    constructor(
        address _paymentToken,
        address _authorizedSigner
    ) EIP712("ResaleLight", "1") {
        owner = msg.sender;
        paymentToken = IERC20(_paymentToken);
        authorizedSigner = _authorizedSigner;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    // Main function to buy NFT from resale listing using EIP-712 signature
    function buyResaleNFT(
        ResaleListing memory listing,
        bytes memory sellerSignature
    ) external {
        require(block.timestamp <= listing.deadline, "Listing expired");
        require(listing.seller != msg.sender, "Cannot buy your own NFT");
        require(listing.price > 0, "Invalid price");
        
        // Verify seller's current nonce
        require(nonces[listing.seller] == listing.nonce, "Invalid nonce");
        
        // Create EIP-712 hash
        bytes32 structHash = keccak256(abi.encode(
            LISTING_TYPEHASH,
            listing.seller,
            listing.nftContract,
            listing.tokenId,
            listing.price,
            listing.deadline,
            listing.nonce
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        
        // Prevent signature replay
        require(!usedSignatures[hash], "Signature already used");
        usedSignatures[hash] = true;
        
        // Verify seller's signature
        require(
            ECDSA.recover(hash, sellerSignature) == listing.seller,
            "Invalid seller signature"
        );
        
        // Check buyer has enough tokens and allowance
        require(
            paymentToken.balanceOf(msg.sender) >= listing.price,
            "Insufficient token balance"
        );
        require(
            paymentToken.allowance(msg.sender, address(this)) >= listing.price,
            "Insufficient token allowance"
        );
        
        // Check seller owns and approved the NFT
        IERC721 nftContract = IERC721(listing.nftContract);
        require(
            nftContract.ownerOf(listing.tokenId) == listing.seller,
            "Seller doesn't own NFT"
        );
        require(
            nftContract.isApprovedForAll(listing.seller, address(this)) ||
            nftContract.getApproved(listing.tokenId) == address(this),
            "NFT not approved for transfer"
        );
        
        // Increment seller's nonce to prevent replay
        nonces[listing.seller]++;
        
        // Calculate platform fee
        uint256 platformFee = (listing.price * platformFeePercentage) / 10000;
        uint256 sellerAmount = listing.price - platformFee;
        
        // Transfer payment tokens
        bool success = paymentToken.transferFrom(
            msg.sender,
            listing.seller,
            sellerAmount
        );
        require(success, "Payment transfer to seller failed");
        
        if (platformFee > 0) {
            success = paymentToken.transferFrom(
                msg.sender,
                owner,
                platformFee
            );
            require(success, "Platform fee transfer failed");
        }
        
        // Transfer NFT
        nftContract.safeTransferFrom(
            listing.seller,
            msg.sender,
            listing.tokenId
        );
        
        emit NFTResold(
            listing.seller,
            msg.sender,
            listing.nftContract,
            listing.tokenId,
            listing.price,
            platformFee
        );
    }
    
    // Allow seller to cancel their listing by incrementing nonce
    function cancelListing(address nftContract, uint256 tokenId) external {
        uint256 currentNonce = nonces[msg.sender];
        nonces[msg.sender]++;
        
        emit ListingCancelled(
            msg.sender,
            nftContract,
            tokenId,
            currentNonce
        );
    }
    
    // Helper function to get user's current nonce
    function getUserNonce(address user) external view returns (uint256) {
        return nonces[user];
    }
    
    // Helper function to check if signature is used
    function isSignatureUsed(bytes32 hash) external view returns (bool) {
        return usedSignatures[hash];
    }
    
    // Helper function to get the domain separator for off-chain signature generation
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
    
    // Helper function to get the type hash for off-chain signature generation
    function getListingTypeHash() external pure returns (bytes32) {
        return LISTING_TYPEHASH;
    }
    
    // Helper function to generate hash for a listing (for off-chain use)
    function getListingHash(ResaleListing memory listing) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            LISTING_TYPEHASH,
            listing.seller,
            listing.nftContract,
            listing.tokenId,
            listing.price,
            listing.deadline,
            listing.nonce
        ));
        return _hashTypedDataV4(structHash);
    }
    
    // Owner functions
    function setPaymentToken(address _paymentToken) external onlyOwner {
        paymentToken = IERC20(_paymentToken);
    }
    
    function setAuthorizedSigner(address _signer) external onlyOwner {
        authorizedSigner = _signer;
    }
    
    function setPlatformFeePercentage(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1000, "Fee too high"); // Max 10%
        platformFeePercentage = _feePercentage;
    }
    
    function withdrawFees() external onlyOwner {
        uint256 balance = paymentToken.balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");
        paymentToken.transfer(owner, balance);
    }
}
