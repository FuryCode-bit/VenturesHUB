// contracts/ExchangeVault.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// This contract's sole purpose is to securely hold the USDC for the SimpleExchange.
contract ExchangeVault is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    constructor(address _usdcTokenAddress, address initialOwner) Ownable(initialOwner) {
        usdcToken = IERC20(_usdcTokenAddress);
    }
    
    function sendUsdc(address to, uint256 amount) external onlyOwner {
        require(usdcToken.balanceOf(address(this)) >= amount, "Vault: Insufficient USDC");
        usdcToken.safeTransfer(to, amount);
    }
}