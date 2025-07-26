// /scripts/mine-blocks.js

const { task, types } = require("hardhat/config");

/**
 * @task mine - Mines a specified number of blocks on the local network.
 * @param {number} blocks - The number of blocks to mine.
 * @usage npx hardhat mine <number-of-blocks> --network localhost
 */

task("mine", "Mines a specified number of blocks on the local network")
  .addPositionalParam(
    "blocks",
    "The number of blocks to mine.",
    undefined,
    types.int
  )
  .setAction(async (taskArgs, hre) => {
    const blocksToMine = taskArgs.blocks;

    console.log(`Starting to mine ${blocksToMine} blocks...`);

    for (let i = 0; i < blocksToMine; i++) {
      await hre.network.provider.send("evm_mine");

      if ((i + 1) % 5 === 0 || i === blocksToMine - 1) {
        console.log(`Block #${i + 1} mined`);
      }
    }

    console.log(`✅ Finished mining ${blocksToMine} blocks.`);
  });