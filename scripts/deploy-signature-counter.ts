import { ethers } from "hardhat";

async function main() {
  console.log("Deploying SignatureCounter contract...");

  // Get the ContractFactory
  const SignatureCounter = await ethers.getContractFactory("SignatureCounter");

  // Deploy the contract
  console.log("Deploying SignatureCounter...");
  const signatureCounter = await SignatureCounter.deploy();

  // Wait for deployment to complete
  await signatureCounter.waitForDeployment();

  const contractAddress = await signatureCounter.getAddress();
  console.log("SignatureCounter deployed to:", contractAddress);

  // Get the deployer address (this will be the owner)
  const [deployer] = await ethers.getSigners();
  console.log("Contract owner:", deployer.address);

  console.log("\n=== Contract Information ===");
  console.log("Address:", contractAddress);
  console.log("Owner:", deployer.address);
  console.log("===========================");

  // Generate sample signature for testing
  console.log("\n=== Generating Sample Signature ===");
  
  const domain = {
    name: "SignatureCounter",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: contractAddress,
  };

  const types = {
    UpdateCount: [
      { name: "newCount", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
  };

  const message = {
    newCount: 42,
    nonce: 1,
  };

  const signature = await deployer.signTypedData(domain, types, message);
  
  console.log("Sample signature for count=42, nonce=1:");
  console.log("Signature:", signature);
  console.log("Domain:", JSON.stringify(domain, null, 2));
  console.log("Message:", JSON.stringify(message, null, 2));

  console.log("\n=== Usage Instructions ===");
  console.log("1. Update frontend SIGNATURE_COUNTER_ADDRESS to:", contractAddress);
  console.log("2. Use the following command to generate signatures:");
  console.log(`   bun run server/generate-counter-signature.ts ${contractAddress} 42 1`);
  console.log("3. Test the signature verification in the frontend");
  console.log("===========================");

  return {
    contractAddress,
    owner: deployer.address,
    sampleSignature: signature,
    domain,
    message
  };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 