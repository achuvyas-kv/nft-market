# CrownMarketplace V4 Deployment Summary

## Deployment Information

**Network:** Sepolia Testnet (Chain ID: 11155111)  
**Deployment Date:** $(date)  
**Deployer Address:** 0x78C80D61acC3BD220e0561904835CB9ba825CfC8

## Contract Addresses

| Contract | Address |
|----------|---------|
| **CrownNFT (V4)** | `0x72E97ea1352C62177614bb3bDa484fb3138959EB` |
| **CrownPurchase (V4)** | `0x0E774A82B49846c246A3a0220637542ddCBf83Fa` |
| **DarkToken** | `0x9740D146D20FCF8643274cCD4Db91210200c9ed4` |

## Configuration Verification

✅ **Ownership Setup:** CrownNFT is owned by CrownPurchase contract  
✅ **Token Configuration:** CrownPurchase correctly configured with DarkToken  
✅ **NFT Configuration:** CrownPurchase correctly configured with CrownNFT  
✅ **Price Setting:** NFT price set to 10.0 DARK tokens  
✅ **Authorized Signer:** Set to deployer address

## New Features in V4

### 1. Multiple NFT Purchase
- **Function:** `buyMultipleNFTs(string[] memory tokenURIs)`
- **Limit:** Up to 10 NFTs per transaction
- **Gas Optimization:** Batch processing for cost efficiency

### 2. EIP712 Signature-Based Transfers
- **Function:** `transferWithSignature(...)`
- **Security:** Cryptographic signatures for marketplace transfers
- **Replay Protection:** Nonce-based system prevents replay attacks
- **Domain Separator:** `0x9af90603226b246003850895fe0f951d8fa9c93dd3966aaa92bf6c427454d5a8`

### 3. Price Management
- **Function:** `setNFTPrice(uint256 _newPrice)`
- **Access:** Owner only
- **Event:** `PriceUpdated` emitted on changes

### 4. Contract Management
- **Functions:** 
  - `setDarkToken(address _darkToken)` - Update token contract
  - `setCrownNFT(address _crownNFT)` - Update NFT contract
  - `setAuthorizedSigner(address _signer)` - Update authorized signer
- **Access:** Owner only

### 5. Token Withdrawal
- **Function:** `withdrawDarkTokens()`
- **Purpose:** Allow owner to withdraw accumulated DARK tokens
- **Access:** Owner only

### 6. Enhanced Security
- **Nonce System:** Prevents replay attacks in signature-based transfers
- **Input Validation:** Comprehensive checks for all parameters
- **Event Logging:** Detailed events for all major operations

## Usage Examples

### Basic NFT Purchase
```solidity
// User approves DARK tokens
darkToken.approve(crownPurchaseAddress, 10 ether);

// Purchase single NFT
crownPurchase.buyNFT("https://metadata.example.com/1");
```

### Multiple NFT Purchase
```solidity
// User approves DARK tokens for multiple NFTs
darkToken.approve(crownPurchaseAddress, 30 ether); // For 3 NFTs

// Purchase multiple NFTs
string[] memory uris = ["uri1", "uri2", "uri3"];
crownPurchase.buyMultipleNFTs(uris);
```

### Signature-Based Transfer
```solidity
// Generate signature off-chain using EIP712
// Then call transfer function
crownPurchase.transferWithSignature(
    from,
    to,
    tokenId,
    price,
    deadline,
    nonce,
    signature
);
```

## Testing Results

- ✅ All contracts deployed successfully
- ✅ Ownership configuration verified
- ✅ EIP712 domain separator generated
- ✅ All new functions accessible
- ✅ Token balances and configurations correct

## Next Steps

1. **Frontend Integration:** Update frontend to use new V4 contract addresses
2. **Testing:** Perform end-to-end testing with actual transactions
3. **Documentation:** Update API documentation with new functions
4. **Monitoring:** Set up monitoring for the new contract addresses

## Important Notes

- The deployer retains ownership of the CrownPurchase contract
- The CrownPurchase contract owns the CrownNFT contract (required for minting)
- All signature-based operations use EIP712 standard for security
- The contract includes comprehensive error messages for debugging

---

**Deployment Module:** `ignition/modules/CrownMarketplaceV4.ts`  
**Test Script:** `scripts/test-crown-v4-deployment.ts` 