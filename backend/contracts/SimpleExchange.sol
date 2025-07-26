// contracts/SimpleExchange.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleExchange is Ownable {
    IERC20 public immutable usdcToken;

    // We will set a fixed rate, e.g., 1 ETH = 1 USDC
    uint256 public constant EXCHANGE_RATE = 1 * (10**6);

    event Swapped(address indexed user, uint256 ethAmount, uint256 usdcAmount);
    event Funded(address indexed funder, uint256 amount);

    constructor(address _usdcTokenAddress) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcTokenAddress);
    }

    // This function allows the owner (deployer) to fill the exchange with USDC
    function fundContract(uint256 amount) external onlyOwner {
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        emit Funded(msg.sender, amount);
    }

    // This is the core function for users. It must be `payable`.
    function swapEthForUsdc() external payable {
        require(msg.value > 0, "Must send some ETH");

        // Calculate how much USDC to send based on the ETH received
        uint256 usdcToSend = (msg.value * EXCHANGE_RATE) / 1e18;

        require(usdcToken.balanceOf(address(this)) >= usdcToSend, "Exchange has insufficient USDC");

        require(usdcToken.transfer(msg.sender, usdcToSend), "USDC transfer failed");
        emit Swapped(msg.sender, msg.value, usdcToSend);
    }

    // Function to allow the owner to withdraw the collected ETH
    function withdrawEth() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "ETH withdrawal failed");
    }
}