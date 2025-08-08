import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ResaleLightModule = buildModule("ResaleLightModuleV1", (m) => {
	// Payment token address (STK token)
	const paymentToken = "0x46AB2cedc835Dd47a73590E132071c66fE75cAF6";
	
	// Authorized signer address (should match the private key used in server)
	const authorizedSigner = "0x78C80D61acC3BD220e0561904835CB9ba825CfC8"; // Derived from the private key in server
	
	const resaleLight = m.contract("ResaleLight", [paymentToken, authorizedSigner]);

	return { resaleLight };
});

export default ResaleLightModule;

// Usage:
// npx hardhat ignition deploy ignition/modules/ResaleLight.ts --network sepolia
// npx hardhat ignition deploy ignition/modules/ResaleLight.ts --network localhost 