import { ethers } from "ethers";

// Config
const INFURA_URL = "https://sepolia.infura.io/v3/62fe7ded81c349f2a237483f8becd2e2";
const PRIVATE_KEY = "e8213130a54556a6c97d6a46143ecbd81870e5e04f0031dc57b9905cc65d0a9a"; // same deployer key used elsewhere
const DARK_TOKEN_ADDRESS = "0x4d4C324C3a408476e25887025dDbA50839ECd7B1"; // DARK on Sepolia

// Minimal ERC20 ABI
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

const provider = new ethers.JsonRpcProvider(INFURA_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const dark = new ethers.Contract(DARK_TOKEN_ADDRESS, ERC20_ABI, signer);

async function getTokenInfo() {
  const [decimals, symbol, name] = await Promise.all([
    dark.getFunction("decimals")(),
    dark.getFunction("symbol")(),
    dark.getFunction("name")()
  ]);
  return { decimals, symbol, name } as { decimals: number; symbol: string; name: string };
}

async function sendDark(recipient: string, amountTokens: string) {
  if (!ethers.isAddress(recipient)) throw new Error(`Invalid recipient: ${recipient}`);

  const { decimals, symbol, name } = await getTokenInfo();
  console.log(`Token: ${name} (${symbol}), Decimals: ${decimals}`);
  const amountWei = ethers.parseUnits(amountTokens, decimals);

  const [fromBal, toBal] = await Promise.all([
    dark.getFunction("balanceOf")(signer.address),
    dark.getFunction("balanceOf")(recipient)
  ]);
  console.log(`Before -> Sender: ${ethers.formatUnits(fromBal, decimals)} ${symbol}, Recipient: ${ethers.formatUnits(toBal, decimals)} ${symbol}`);

  if (fromBal < amountWei) {
    throw new Error(`Insufficient balance. Need ${amountTokens} ${symbol}, have ${ethers.formatUnits(fromBal, decimals)} ${symbol}`);
  }

  const tx = await dark.getFunction("transfer")(recipient, amountWei);
  console.log(`Tx sent: ${tx.hash}`);
  const rcpt = await tx.wait();
  console.log(`Confirmed in block ${rcpt?.blockNumber}`);

  const [fromAfter, toAfter] = await Promise.all([
    dark.getFunction("balanceOf")(signer.address),
    dark.getFunction("balanceOf")(recipient)
  ]);
  console.log(`After  -> Sender: ${ethers.formatUnits(fromAfter, decimals)} ${symbol}, Recipient: ${ethers.formatUnits(toAfter, decimals)} ${symbol}`);
}

async function checkBalance(address: string) {
  if (!ethers.isAddress(address)) throw new Error(`Invalid address: ${address}`);
  const { decimals, symbol, name } = await getTokenInfo();
  const bal = await dark.getFunction("balanceOf")(address);
  console.log(`Balance of ${address}: ${ethers.formatUnits(bal, decimals)} ${symbol}`);
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage: bun send-dark.ts transfer <recipient> <amount> | balance <address> | my-balance");
    process.exit(1);
  }
  const cmd = String(args[0]);
  (async () => {
    if (cmd === "transfer") {
      const recipient = String(args[1]);
      const amount = String(args[2]);
      await sendDark(recipient, amount);
    } else if (cmd === "balance") {
      const address = String(args[1]);
      await checkBalance(address);
    } else if (cmd === "my-balance") {
      await checkBalance(signer.address);
    } else {
      console.log("Usage: bun send-dark.ts transfer <recipient> <amount> | balance <address> | my-balance");
      process.exit(1);
    }
  })().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
} 