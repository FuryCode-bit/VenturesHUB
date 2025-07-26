// contracts/PlatformTreasury.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PlatformTreasury is Ownable {
    using SafeERC20 for IERC20;

    constructor(address initialOwner) Ownable(initialOwner) {}

    // Allows the platform owner to later manage the collected shares
    function withdrawTokens(IERC20 token, address to, uint256 amount) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        require(amount <= balance, "Insufficient balance");
        token.safeTransfer(to, amount);
    }
}