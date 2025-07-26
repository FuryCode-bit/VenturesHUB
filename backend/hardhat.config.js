require("@nomicfoundation/hardhat-toolbox");
    
require("./scripts/time.js");
require("./scripts/mine-blocks.js");
    
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      allowUnlimitedContractSize: true,
    },
  },
};
