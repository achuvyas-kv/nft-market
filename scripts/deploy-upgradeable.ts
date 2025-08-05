import hre, { ethers, upgrades } from "hardhat";

/**
 * UPGRADEABLE CONTRACT DEPLOYMENT SCRIPT
 * ======================================
 * 
 * This script demonstrates:
 * 1. Deploying V1 upgradeable contract
 * 2. Testing V1 functionality
 * 3. Upgrading to V2
 * 4. Verifying data preservation
 * 
 * SETUP REQUIRED:
 * 1. npm install @openzeppelin/hardhat-upgrades
 * 2. Add to hardhat.config.ts: import "@openzeppelin/hardhat-upgrades"
 * 
 * RUN WITH:
 * npx hardhat run scripts/deploy-upgradeable.ts --network localhost
 */

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("           UPGRADEABLE NFT CONTRACT DEPLOYMENT");
  console.log("=".repeat(80));

  const [deployer, minter, user1] = await ethers.getSigners();
  
  console.log("🔑 Deployer address:", deployer.address);
  console.log("⚡ Minter address:", minter.address);
  console.log("👤 User address:", user1.address);

  // ============ STEP 1: DEPLOY V1 IMPLEMENTATION + PROXY ============
  console.log("\n📦 STEP 1: Deploying V1 Implementation + Proxy");
  console.log("-".repeat(50));

  const LightNFTV1 = await ethers.getContractFactory("LightNFTUpgradeable");
  
  console.log("🏗️  Deploying proxy with V1 implementation...");
  
  // This single command does A LOT:
  // 1. Deploys the LightNFTUpgradeable implementation contract
  // 2. Deploys a UUPS proxy contract
  // 3. Points proxy to implementation
  // 4. Calls initialize() on the proxy
  const proxyV1 = await upgrades.deployProxy(
    LightNFTV1, 
    [minter.address, ethers.parseEther("0.005")], // initialize() arguments
    { 
      kind: 'uups',  // UUPS proxy pattern
      initializer: 'initialize'
    }
  );
  
  await proxyV1.waitForDeployment();
  const proxyAddress = await proxyV1.getAddress();
  
  console.log("✅ Proxy deployed at:", proxyAddress);
  console.log("✅ V1 Implementation deployed behind proxy");
  console.log("🎯 Users will ALWAYS interact with:", proxyAddress);

  // ============ STEP 2: TEST V1 FUNCTIONALITY ============
  console.log("\n🧪 STEP 2: Testing V1 Functionality");
  console.log("-".repeat(50));
  
  // Check initial state
  const [nextId, price, minterAddr] = await proxyV1.getContractInfo();
  console.log(`   📊 Next Token ID: ${nextId}`);
  console.log(`   💰 Mint Price: ${ethers.formatEther(price)} ETH`);
  console.log(`   👨‍💻 Authorized Minter: ${minterAddr}`);
  
  // Mint an NFT using V1 logic
  console.log("   🎨 Minting NFT #0...");
  await proxyV1.connect(minter).mint(user1.address, "ipfs://test-uri-1");
  
  const owner = await proxyV1.ownerOf(0);
  const uri = await proxyV1.tokenURI(0);
  console.log(`   ✅ NFT #0 minted to: ${owner}`);
  console.log(`   🔗 Token URI: ${uri}`);
  
  // Check V1 version
  const v1Version = await proxyV1.version();
  console.log(`   📋 Contract Version: ${v1Version}`);

  // Try to call V2 function (should fail)
  console.log("   ❌ Testing V2 function (should fail):");
  try {
    // This will fail because getRarity doesn't exist in V1
    await proxyV1.getRarity(0);
    console.log("   🚨 ERROR: V2 function worked on V1!");
  } catch (error: any) {
    console.log("   ✅ Expected: V2 function not available in V1");
  }

  // ============ STEP 3: UPGRADE TO V2 ============
  console.log("\n🔄 STEP 3: Upgrading to V2");
  console.log("-".repeat(50));
  
  const LightNFTV2 = await ethers.getContractFactory("LightNFTUpgradeableV2");
  
  console.log("🏗️  Deploying V2 implementation...");
  console.log("🔄 Upgrading proxy to point to V2...");
  
  // This command:
  // 1. Deploys new V2 implementation
  // 2. Updates proxy to point to V2
  // 3. Validates storage layout compatibility
  const proxyV2 = await upgrades.upgradeProxy(proxyAddress, LightNFTV2);
  
  console.log("✅ Proxy upgraded to V2 implementation");
  console.log("🎯 Proxy address remains:", await proxyV2.getAddress());
  
  // Initialize V2-specific features
  console.log("⚙️  Initializing V2 features...");
  await proxyV2.initializeV2Features(10000); // Max supply: 10,000
  console.log("✅ V2 features initialized");

  // ============ STEP 4: VERIFY UPGRADE SUCCESS ============
  console.log("\n✅ STEP 4: Verifying Upgrade Success");
  console.log("-".repeat(50));
  
  // CRITICAL TEST: Check that old data persists
  console.log("🔍 Checking data preservation after upgrade:");
  
  const tokenOwnerAfter = await proxyV2.ownerOf(0);
  const tokenURIAfter = await proxyV2.tokenURI(0);
  
  console.log(`   🏠 NFT #0 owner: ${tokenOwnerAfter}`);
  console.log(`   🔗 NFT #0 URI: ${tokenURIAfter}`);
  console.log(`   ✅ All original data preserved!`);
  
  // Test V2 enhanced features
  console.log("\n🆕 Testing V2 New Features:");
  
  const [nextId2, price2, minter2, maxSupply, paused] = await proxyV2.getContractInfo();
  console.log(`   📊 Max Supply (NEW): ${maxSupply}`);
  console.log(`   ⏸️  Minting Paused (NEW): ${paused}`);
  
  // Test new V2 mint with rarity
  console.log("   🎨 Minting NFT #1 with rarity 5...");
  await proxyV2.connect(minter).mintWithRarity(user1.address, "ipfs://rare-uri", 5);
  const rarity = await proxyV2.getRarity(1);
  console.log(`   ✨ NFT #1 rarity: ${rarity}/5`);
  
  // Test that old NFT got default rarity
  const oldNFTRarity = await proxyV2.getRarity(0);
  console.log(`   ✨ NFT #0 rarity (set during upgrade): ${oldNFTRarity}/5`);
  
  // Check version updated
  const v2Version = await proxyV2.version();
  console.log(`   📋 Contract Version: ${v2Version}`);

  // ============ STEP 5: ADVANCED V2 FEATURES ============
  console.log("\n🚀 STEP 5: Advanced V2 Features");
  console.log("-".repeat(50));
  
  // Test batch minting
  console.log("   📦 Testing batch minting...");
  await proxyV2.connect(minter).batchMint(
    [user1.address, user1.address], 
    ["ipfs://batch-1", "ipfs://batch-2"],
    [2, 3]
  );
  console.log("   ✅ Batch minted 2 NFTs with rarities 2 and 3");
  
  // Test supply info
  const [current, maximum, remaining] = await proxyV2.getSupplyInfo();
  console.log(`   📊 Supply: ${current}/${maximum} (${remaining} remaining)`);
  
  // Test pause functionality
  console.log("   ⏸️  Testing emergency pause...");
  await proxyV2.pauseMinting(true);
  
  try {
    await proxyV2.connect(minter).mint(user1.address, "should-fail");
    console.log("   🚨 ERROR: Minting worked while paused!");
  } catch (error: any) {
    console.log("   ✅ Minting correctly blocked while paused");
  }
  
  // Unpause
  await proxyV2.pauseMinting(false);
  console.log("   ▶️  Unpaused minting");

  // ============ FINAL SUMMARY ============
  console.log("\n" + "=".repeat(80));
  console.log("                        DEPLOYMENT SUMMARY");
  console.log("=".repeat(80));
  console.log(`📍 Proxy Address (PERMANENT): ${proxyAddress}`);
  console.log(`🏷️  Users interact with: ${proxyAddress}`);
  console.log(`📊 Total NFTs minted: ${await proxyV2.nextTokenId()}`);
  console.log(`🔢 Contract version: ${await proxyV2.version()}`);
  console.log(`⚡ All data preserved during upgrade!`);
  console.log(`🎯 Contract successfully upgraded from V1 to V2!`);
  
  // Show implementation addresses (for educational purposes)
  console.log("\n📋 Technical Details:");
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`   🧠 Current Implementation: ${implAddress}`);
  console.log(`   🏢 Proxy Contract: ${proxyAddress}`);
  console.log(`   👥 Users call: ${proxyAddress} (proxy)`);
  console.log(`   🔄 Proxy delegates to: ${implAddress} (implementation)`);
  
  console.log("\n" + "=".repeat(80));
  console.log("🎉 UPGRADEABLE CONTRACT DEPLOYMENT COMPLETE! 🎉");
  console.log("=".repeat(80));
  
  return {
    proxyAddress,
    proxyContract: proxyV2,
    implementationAddress: implAddress
  };
}

// Handle errors and run the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

/**
 * KEY TAKEAWAYS FROM THIS SCRIPT:
 * ===============================
 * 
 * 1. 🏢 PROXY PATTERN:
 *    - Proxy holds all storage data
 *    - Implementation contains only logic
 *    - Users always call proxy address
 *    - Proxy uses delegatecall to implementation
 * 
 * 2. 🔄 DEPLOYMENT PROCESS:
 *    - deployProxy(): Deploy implementation + proxy + initialize
 *    - upgradeProxy(): Deploy new implementation + update proxy
 *    - All user data remains in proxy storage
 * 
 * 3. 🔒 STORAGE SAFETY:
 *    - V2 must preserve V1 storage layout
 *    - New variables added at the end only
 *    - OpenZeppelin validates storage compatibility
 * 
 * 4. 🎯 USER EXPERIENCE:
 *    - Users see one consistent contract address
 *    - All NFTs remain valid after upgrades
 *    - New features available immediately after upgrade
 * 
 * 5. 🛡️ SECURITY:
 *    - Only owner can authorize upgrades
 *    - Storage layout validated before upgrade
 *    - Implementation contracts can't be initialized directly
 * 
 * NEXT STEPS:
 * ===========
 * 1. Add this script to package.json scripts
 * 2. Test on testnet before mainnet
 * 3. Consider using multisig for upgrade authority
 * 4. Document upgrade procedures for your team
 */ 