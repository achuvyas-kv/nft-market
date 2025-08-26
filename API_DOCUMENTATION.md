# NFT Marketplace API Documentation

## Overview

This documentation provides comprehensive information about the NFT Marketplace smart contracts and server APIs. The marketplace consists of three main components:

1. **Smart Contracts** - Solidity contracts deployed on Sepolia testnet
2. **Server APIs** - Node.js/Bun server providing backend services
3. **Frontend Integration** - React/TypeScript frontend application

## Table of Contents

- [Smart Contracts](#smart-contracts)
  - [CrownNFTSimple](#crownnftsimple)
  - [CrownPurchase](#crownpurchase)
  - [DarkToken](#darktoken)
  - [SignatureCounter](#signaturecounter)
- [Server APIs](#server-apis)
  - [Authentication & Setup](#authentication--setup)
  - [NFT Management](#nft-management)
  - [Marketplace Operations](#marketplace-operations)
  - [Signature Generation](#signature-generation)
  - [Database Operations](#database-operations)
- [Frontend Integration](#frontend-integration)
- [SDK Development Guide](#sdk-development-guide)

---

## Smart Contracts

### Contract Addresses (Sepolia Testnet)

```javascript
const CONTRACTS = {
  CROWN_NFT: "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6",
  CROWN_PURCHASE: "0xB7Aa678187441466e11B2EFCF6a9716AC7Bb840c",
  DARK_TOKEN: "0x4d4C324C3a408476e25887025dDbA50839ECd7B1",
  SIGNATURE_COUNTER: "0x13AC5e813795099711d5A1357469BDb12B761656"
};
```

### CrownNFTSimple

**Contract**: `CrownNFTSimple.sol`  
**Address**: `0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6`  
**Type**: ERC721 NFT Collection

#### Functions

##### `mint(address to, string memory uri)`
- **Description**: Mints a new NFT to the specified address
- **Access**: Only owner
- **Parameters**:
  - `to` (address): Recipient address
  - `uri` (string): Token metadata URI
- **Returns**: `uint256` - Token ID of the minted NFT

```javascript
// Example usage
const tokenId = await crownNFT.mint(userAddress, "ipfs://Qm...");
```

##### `mintBatch(address to, string[] memory uris)`
- **Description**: Mints multiple NFTs in a single transaction
- **Access**: Only owner
- **Parameters**:
  - `to` (address): Recipient address
  - `uris` (string[]): Array of metadata URIs
- **Returns**: `uint256[]` - Array of token IDs

##### `marketplaceTransfer(address from, address to, uint256 tokenId)`
- **Description**: Transfers NFT between addresses (marketplace function)
- **Access**: Only owner (marketplace contract)
- **Parameters**:
  - `from` (address): Current owner
  - `to` (address): New owner
  - `tokenId` (uint256): Token ID to transfer

##### `totalSupply()`
- **Description**: Returns total number of minted NFTs
- **Returns**: `uint256` - Total supply

##### `nextTokenId()`
- **Description**: Returns the next token ID to be minted
- **Returns**: `uint256` - Next token ID

##### `tokenURI(uint256 tokenId)`
- **Description**: Returns metadata URI for a token
- **Parameters**: `tokenId` (uint256)
- **Returns**: `string` - Metadata URI

#### Events

```solidity
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
```

### CrownPurchase

**Contract**: `CrownPurchase.sol`  
**Address**: `0xB7Aa678187441466e11B2EFCF6a9716AC7Bb840c`  
**Type**: Marketplace Contract

#### Functions

##### `buyNFT(string memory tokenURI)`
- **Description**: Purchases a new NFT from the marketplace
- **Parameters**: `tokenURI` (string) - Metadata URI for the NFT
- **Returns**: `uint256` - Token ID of purchased NFT
- **Requirements**:
  - Sufficient DARK token balance
  - Sufficient DARK token allowance

```javascript
// Example usage
const tokenId = await crownPurchase.buyNFT("ipfs://Qm...");
```

##### `transferNFTWithSignature(address from, address to, uint256 tokenId, uint256 price, uint256 deadline, uint256 nonce, bytes memory signature)`
- **Description**: Transfers NFT using EIP-712 signature
- **Parameters**:
  - `from` (address): Current owner
  - `to` (address): New owner
  - `tokenId` (uint256): Token ID
  - `price` (uint256): Transfer price in DARK tokens
  - `deadline` (uint256): Signature expiration timestamp
  - `nonce` (uint256): Unique nonce
  - `signature` (bytes): EIP-712 signature
- **Requirements**:
  - Valid signature from authorized signer
  - Nonce not used before
  - Deadline not expired

##### `getNFTPrice()`
- **Description**: Returns current NFT price
- **Returns**: `uint256` - Price in DARK tokens (with 18 decimals)

##### `nonces(address owner)`
- **Description**: Returns nonce for an address
- **Parameters**: `owner` (address)
- **Returns**: `uint256` - Current nonce

#### Events

```solidity
event NFTPurchased(address indexed buyer, uint256 indexed tokenId, uint256 price);
event PriceUpdated(uint256 oldPrice, uint256 newPrice);
event MarketplaceTransfer(address indexed from, address indexed to, uint256 indexed tokenId, uint256 price);
```

### DarkToken

**Contract**: `DarkToken.sol`  
**Address**: `0x4d4C324C3a408476e25887025dDbA50839ECd7B1`  
**Type**: ERC20 Token

#### Functions

##### `mint(address to, uint256 amount)`
- **Description**: Mints new DARK tokens
- **Access**: Only owner
- **Parameters**:
  - `to` (address): Recipient address
  - `amount` (uint256): Amount to mint

##### `burn(uint256 amount)`
- **Description**: Burns DARK tokens from caller's balance
- **Parameters**: `amount` (uint256): Amount to burn

##### `decimals()`
- **Description**: Returns token decimals
- **Returns**: `uint8` - Token decimals (18)

#### Standard ERC20 Functions

- `balanceOf(address account)` - Get balance
- `transfer(address to, uint256 amount)` - Transfer tokens
- `approve(address spender, uint256 amount)` - Approve spending
- `allowance(address owner, address spender)` - Check allowance

### SignatureCounter

**Contract**: `SignatureCounter.sol`  
**Address**: `0x13AC5e813795099711d5A1357469BDb12B761656`  
**Type**: EIP-712 Signature Verification

#### Functions

##### `updateCountWithSignature(uint256 newCount, uint256 nonce, bytes memory signature)`
- **Description**: Updates counter using EIP-712 signature
- **Parameters**:
  - `newCount` (uint256): New counter value
  - `nonce` (uint256): Unique nonce
  - `signature` (bytes): EIP-712 signature

##### `getCurrentCount()`
- **Description**: Returns current counter value
- **Returns**: `uint256` - Current count

##### `getDomainSeparator()`
- **Description**: Returns EIP-712 domain separator
- **Returns**: `bytes32` - Domain separator

##### `getUpdateCountHash(uint256 newCount, uint256 nonce)`
- **Description**: Returns hash for signature verification
- **Returns**: `bytes32` - Typed data hash

---

## Server APIs

### Base URL
```
http://localhost:3000
```

### Authentication & Setup

#### GET `/contract-info`
Returns contract addresses and network information.

**Response**:
```json
{
  "crownNFT": "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6",
  "crownPurchase": "0xB7Aa678187441466e11B2EFCF6a9716AC7Bb840c",
  "darkToken": "0x4d4C324C3a408476e25887025dDbA50839ECd7B1",
  "network": "sepolia"
}
```

### NFT Management

#### GET `/nfts`
Returns all NFTs in the database.

**Query Parameters**:
- `owner` (optional): Filter by owner address
- `contractAddress` (optional): Filter by contract address

**Response**:
```json
{
  "success": true,
  "nfts": [
    {
      "tokenId": "1",
      "contractAddress": "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6",
      "ownerAddress": "0x...",
      "metadataUri": "ipfs://Qm...",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### GET `/nfts/:tokenId`
Returns specific NFT by token ID.

**Response**:
```json
{
  "success": true,
  "nft": {
    "tokenId": "1",
    "contractAddress": "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6",
    "ownerAddress": "0x...",
    "metadataUri": "ipfs://Qm...",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### Marketplace Operations

#### POST `/create-listing`
Creates a new NFT listing.

**Request Body**:
```json
{
  "tokenId": "1",
  "contractAddress": "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6",
  "sellerAddress": "0x...",
  "price": "1000000000000000000",
  "deadline": 1735689600
}
```

**Response**:
```json
{
  "success": true,
  "listing": {
    "id": 1,
    "tokenId": "1",
    "contractAddress": "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6",
    "sellerAddress": "0x...",
    "price": "1000000000000000000",
    "deadline": 1735689600,
    "nonce": 1,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### GET `/get-listing`
Gets active listing for an NFT.

**Query Parameters**:
- `tokenId` (required): Token ID
- `contractAddress` (optional): Contract address

**Response**:
```json
{
  "success": true,
  "listing": {
    "tokenId": "1",
    "contractAddress": "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6",
    "sellerAddress": "0x...",
    "price": "1000000000000000000",
    "deadline": 1735689600,
    "nonce": 1
  }
}
```

### Signature Generation

#### POST `/generate-transfer-signature`
Generates EIP-712 signature for NFT transfer.

**Request Body**:
```json
{
  "from": "0x...",
  "to": "0x...",
  "tokenId": "1",
  "price": "1000000000000000000"
}
```

**Response**:
```json
{
  "success": true,
  "signature": "0x...",
  "transferData": {
    "from": "0x...",
    "to": "0x...",
    "tokenId": 1,
    "price": "1000000000000000000",
    "deadline": 1735689600,
    "nonce": 1
  },
  "timestamp": 1735689600
}
```

#### POST `/generate-counter-signature`
Generates signature for counter update.

**Request Body**:
```json
{
  "newCount": 42,
  "nonce": 1
}
```

**Response**:
```json
{
  "success": true,
  "signature": "0x...",
  "data": {
    "newCount": 42,
    "nonce": 1
  }
}
```

### Database Operations

#### POST `/apply-purchase`
Applies purchase from transaction hash.

**Request Body**:
```json
{
  "txHash": "0x..."
}
```

**Response**:
```json
{
  "success": true,
  "applied": {
    "tokenId": "1",
    "from": "0x...",
    "to": "0x...",
    "price": "1000000000000000000",
    "txHash": "0x..."
  }
}
```

#### GET `/sync`
Syncs blockchain events to database.

**Response**:
```json
{
  "success": true,
  "eventsProcessed": 150,
  "transferEvents": 100,
  "purchaseEvents": 30,
  "resaleEvents": 20
}
```

#### GET `/debug-db`
Returns database statistics.

**Response**:
```json
{
  "ownersCount": 50,
  "crownNftsCount": 100,
  "totalNftsCount": 100,
  "sampleCrownNfts": [...],
  "contractAddresses": ["0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6"],
  "expectedContractAddress": "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6"
}
```

---

## Frontend Integration

### Setup

```javascript
import { ethers } from 'ethers';

// Contract addresses
const CONTRACTS = {
  CROWN_NFT: "0x65B3b1064C04e2E54A055ccf0a3F5e4077B4fBf6",
  CROWN_PURCHASE: "0xB7Aa678187441466e11B2EFCF6a9716AC7Bb840c",
  DARK_TOKEN: "0x4d4C324C3a408476e25887025dDbA50839ECd7B1"
};

// API base URL
const API_BASE_URL = "http://localhost:3000";
```

### Wallet Connection

```javascript
const connectWallet = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask not found");
  }
  
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  
  // Check network
  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error("Please switch to Sepolia network");
  }
  
  return { provider, signer, address };
};
```

### Contract Interactions

```javascript
// Initialize contracts
const crownNFT = new ethers.Contract(CONTRACTS.CROWN_NFT, CrownNFTABI, signer);
const crownPurchase = new ethers.Contract(CONTRACTS.CROWN_PURCHASE, CrownPurchaseABI, signer);
const darkToken = new ethers.Contract(CONTRACTS.DARK_TOKEN, DarkTokenABI, signer);

// Buy NFT
const buyNFT = async (tokenURI) => {
  const price = await crownPurchase.getNFTPrice();
  
  // Approve DARK tokens
  await darkToken.approve(CONTRACTS.CROWN_PURCHASE, price);
  
  // Purchase NFT
  const tx = await crownPurchase.buyNFT(tokenURI);
  const receipt = await tx.wait();
  
  return receipt;
};

// Transfer NFT with signature
const transferNFT = async (from, to, tokenId, price) => {
  // Get signature from server
  const response = await fetch(`${API_BASE_URL}/generate-transfer-signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, tokenId, price })
  });
  
  const { signature, transferData } = await response.json();
  
  // Execute transfer
  const tx = await crownPurchase.transferNFTWithSignature(
    transferData.from,
    transferData.to,
    transferData.tokenId,
    transferData.price,
    transferData.deadline,
    transferData.nonce,
    signature
  );
  
  return await tx.wait();
};
```

---

## SDK Development Guide

### Creating an SDK

Here's a template for creating an SDK for the NFT marketplace:

```typescript
class NFTMarketplaceSDK {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private apiBaseUrl: string;
  
  constructor(provider: ethers.Provider, signer: ethers.Signer, apiBaseUrl: string) {
    this.provider = provider;
    this.signer = signer;
    this.apiBaseUrl = apiBaseUrl;
  }
  
  // Contract instances
  private get crownNFT() {
    return new ethers.Contract(CONTRACTS.CROWN_NFT, CrownNFTABI, this.signer);
  }
  
  private get crownPurchase() {
    return new ethers.Contract(CONTRACTS.CROWN_PURCHASE, CrownPurchaseABI, this.signer);
  }
  
  private get darkToken() {
    return new ethers.Contract(CONTRACTS.DARK_TOKEN, DarkTokenABI, this.signer);
  }
  
  // NFT Methods
  async getNFTs(owner?: string) {
    const params = owner ? `?owner=${owner}` : '';
    const response = await fetch(`${this.apiBaseUrl}/nfts${params}`);
    return response.json();
  }
  
  async getNFT(tokenId: string) {
    const response = await fetch(`${this.apiBaseUrl}/nfts/${tokenId}`);
    return response.json();
  }
  
  // Marketplace Methods
  async buyNFT(tokenURI: string) {
    const price = await this.crownPurchase.getNFTPrice();
    
    // Approve tokens
    await this.darkToken.approve(CONTRACTS.CROWN_PURCHASE, price);
    
    // Purchase
    const tx = await this.crownPurchase.buyNFT(tokenURI);
    return await tx.wait();
  }
  
  async createListing(tokenId: string, price: string, deadline: number) {
    const address = await this.signer.getAddress();
    
    const response = await fetch(`${this.apiBaseUrl}/create-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenId,
        contractAddress: CONTRACTS.CROWN_NFT,
        sellerAddress: address,
        price,
        deadline
      })
    });
    
    return response.json();
  }
  
  async transferNFT(from: string, to: string, tokenId: string, price: string) {
    // Get signature
    const response = await fetch(`${this.apiBaseUrl}/generate-transfer-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, tokenId, price })
    });
    
    const { signature, transferData } = await response.json();
    
    // Execute transfer
    const tx = await this.crownPurchase.transferNFTWithSignature(
      transferData.from,
      transferData.to,
      transferData.tokenId,
      transferData.price,
      transferData.deadline,
      transferData.nonce,
      signature
    );
    
    return await tx.wait();
  }
  
  // Utility Methods
  async getContractInfo() {
    const response = await fetch(`${this.apiBaseUrl}/contract-info`);
    return response.json();
  }
  
  async getDarkTokenBalance(address: string) {
    return await this.darkToken.balanceOf(address);
  }
  
  async getNFTPrice() {
    return await this.crownPurchase.getNFTPrice();
  }
}

// Usage example
const sdk = new NFTMarketplaceSDK(provider, signer, "http://localhost:3000");

// Get user's NFTs
const myNFTs = await sdk.getNFTs(userAddress);

// Buy an NFT
const receipt = await sdk.buyNFT("ipfs://Qm...");

// Create a listing
const listing = await sdk.createListing("1", "1000000000000000000", 1735689600);
```

### Error Handling

```typescript
class MarketplaceError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'MarketplaceError';
  }
}

// Error handling in SDK methods
async buyNFT(tokenURI: string) {
  try {
    const price = await this.crownPurchase.getNFTPrice();
    const balance = await this.darkToken.balanceOf(await this.signer.getAddress());
    
    if (balance < price) {
      throw new MarketplaceError(
        "Insufficient DARK token balance",
        "INSUFFICIENT_BALANCE",
        { balance: balance.toString(), required: price.toString() }
      );
    }
    
    // ... rest of the method
  } catch (error) {
    if (error instanceof MarketplaceError) {
      throw error;
    }
    throw new MarketplaceError(
      "Failed to buy NFT",
      "BUY_NFT_FAILED",
      { originalError: error.message }
    );
  }
}
```

### TypeScript Types

```typescript
interface NFT {
  tokenId: string;
  contractAddress: string;
  ownerAddress: string;
  metadataUri?: string;
  createdAt: string;
}

interface Listing {
  id: number;
  tokenId: string;
  contractAddress: string;
  sellerAddress: string;
  price: string;
  deadline: number;
  nonce: number;
  isActive: boolean;
  createdAt: string;
}

interface TransferData {
  from: string;
  to: string;
  tokenId: number;
  price: string;
  deadline: number;
  nonce: number;
}

interface SignatureResponse {
  success: boolean;
  signature: string;
  transferData: TransferData;
  timestamp: number;
}
```

This documentation provides a comprehensive guide for developers to integrate with the NFT marketplace, whether they're building frontend applications, backend services, or SDKs. 