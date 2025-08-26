// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

contract SignatureCounter is Ownable, EIP712 {
    using ECDSA for bytes32;

    uint256 public count;
    mapping(uint256 => bool) public usedNonces;

    // EIP712 Domain
    string private constant SIGNING_DOMAIN = "SignatureCounter";
    string private constant SIGNATURE_VERSION = "1";

    // EIP712 TypeHash
    bytes32 private constant UPDATE_COUNT_TYPEHASH = 
        keccak256("UpdateCount(uint256 newCount,uint256 nonce)");

    struct UpdateCount {
        uint256 newCount;
        uint256 nonce;
    }

    event CountUpdated(uint256 oldCount, uint256 newCount, address updatedBy);
    event SignatureUsed(uint256 nonce, address signer);

    constructor() EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) Ownable(msg.sender) {
        count = 0;
    }

    function updateCountWithSignature(
        uint256 newCount,
        uint256 nonce,
        bytes memory signature
    ) external {
        require(!usedNonces[nonce], "Nonce already used");
        
        // Create the struct hash
        bytes32 structHash = keccak256(abi.encode(
            UPDATE_COUNT_TYPEHASH,
            newCount,
            nonce
        ));

        // Create the digest
        bytes32 digest = _hashTypedDataV4(structHash);

        // Verify signature using EIP-1271 or ECDSA
        require(_isValidSignature(digest, signature), "Invalid signature");

        // Mark nonce as used
        usedNonces[nonce] = true;

        // Update count
        uint256 oldCount = count;
        count = newCount;

        emit CountUpdated(oldCount, newCount, msg.sender);
        emit SignatureUsed(nonce, owner());
    }

    function _isValidSignature(bytes32 hash, bytes memory signature) internal view returns (bool) {
        address ownerAddress = owner();
        
        // Check if owner is a contract (smart wallet)
        if (ownerAddress.code.length > 0) {
            // Try EIP-1271 verification
            try IERC1271(ownerAddress).isValidSignature(hash, signature) returns (bytes4 magicValue) {
                return magicValue == IERC1271.isValidSignature.selector;
            } catch {
                return false;
            }
        } else {
            // Standard ECDSA verification for EOA
            address signer = hash.recover(signature);
            return signer == ownerAddress;
        }
    }

    function getCurrentCount() external view returns (uint256) {
        return count;
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getUpdateCountHash(uint256 newCount, uint256 nonce) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            UPDATE_COUNT_TYPEHASH,
            newCount,
            nonce
        ));
        return _hashTypedDataV4(structHash);
    }

    function isNonceUsed(uint256 nonce) external view returns (bool) {
        return usedNonces[nonce];
    }
} 