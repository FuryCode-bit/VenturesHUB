// scripts/deploy.js
const hre = require("hardhat");
const { ethers } = hre;

// --- Configuration ---
const CONFIG = {
  paymentTokenName: "Mock USDC",
  paymentTokenSymbol: "mUSDC",
  exchangeFundAmount: "500000",
};


// --- A helper function to deploy contracts, log their addresses, and wait for deployment  ---
async function deployContract(contractName, args = []) {
  console.log(`\nDeploying ${contractName}...`);
  const ContractFactory = await ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(...args);
  await contract.waitForDeployment();
  console.log(`✅ ${contractName} deployed to: ${contract.target}`);
  return contract;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("----------------------------------------------------");
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
  console.log("----------------------------------------------------");

  const deploymentInfo = {};

  // =================================================================
  // PHASE 1: DEPLOY CORE INFRASTRUCTURE
  // These are the foundational, platform-wide contracts.
  // =================================================================
  
  const paymentToken = await deployContract("MockERC20", [
    CONFIG.paymentTokenName,
    CONFIG.paymentTokenSymbol,
  ]);
  deploymentInfo.MockUSDC = paymentToken.target;

  const platformTreasury = await deployContract("PlatformTreasury", [
    deployer.address,
  ]);
  deploymentInfo.PlatformTreasury = platformTreasury.target;
  
  // =================================================================
  // PHASE 2: DEPLOY APPLICATION CONTRACTS
  // These contracts constitute the main logic of the dApp.
  // =================================================================

  const ventureNFT = await deployContract("VentureNFT", [deployer.address]);
  deploymentInfo.VentureNFT = ventureNFT.target;

  const ventureFactory = await deployContract("VentureFactory", [
    ventureNFT.target,
    paymentToken.target,
    platformTreasury.target,
  ]);
  deploymentInfo.VentureFactory = ventureFactory.target;

  const simpleExchange = await deployContract("SimpleExchange", [paymentToken.target]);
  deploymentInfo.SimpleExchange = simpleExchange.target;

  const marketplace = await deployContract("Marketplace", [paymentToken.target]);
  deploymentInfo.Marketplace = marketplace.target;

  // =================================================================
  // PHASE 3: POST-DEPLOYMENT CONFIGURATION
  // Setting up initial state and transferring ownership.
  // =================================================================

  console.log("\n--- Starting Post-Deployment Configuration ---");

  // Fund the SimpleExchange with mUSDC
  console.log(`\nFunding the SimpleExchange with ${CONFIG.exchangeFundAmount} mUSDC...`);
  const fundAmount = ethers.parseUnits(CONFIG.exchangeFundAmount, 6); // USDC has 6 decimals
  await (await paymentToken.approve(simpleExchange.target, fundAmount)).wait();
  await (await simpleExchange.fundContract(fundAmount)).wait();
  console.log("✅ SimpleExchange funded successfully!");

  // Transfer ownership of the VentureNFT contract to the VentureFactory
  console.log("\nTransferring ownership of VentureNFT to VentureFactory...");
  await (await ventureNFT.transferOwnership(ventureFactory.target)).wait();
  console.log("✅ VentureNFT ownership transferred successfully!");

  console.log("\n--- Configuration Complete ---");

  console.log("\n----------------------------------------------------");
  console.log("✅ Deployment Complete!");
  console.log("----------------------------------------------------\n");
  
  console.log("--- Deployed Contract Addresses ---");
  for (const [name, address] of Object.entries(deploymentInfo)) {
      console.log(`${name}: ${address}`);
  }
  console.log("\n----------------------------------------------------");
  console.log("\n✅ Deployment summary saved to: deployment-summary.json");
  console.log("----------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});