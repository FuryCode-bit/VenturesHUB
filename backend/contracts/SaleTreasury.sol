// contracts/SaleTreasury.sol
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SaleTreasury is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DEMO_ADMIN_ROLE = keccak256("DEMO_ADMIN_ROLE");

    IERC20 public immutable shareToken;
    IERC20 public immutable paymentToken;
    
    uint256 public pricePerShare;
    
    uint256 public immutable totalSharesForSale;
    uint256 public sharesSold;
    address public immutable founderAddress;
    address public immutable investableFundsWallet;
    address public immutable platformTreasury;

    event SharesPurchased(address indexed buyer, uint256 numShares, uint256 cost);
    event SharesSoldBack(address indexed seller, uint256 numShares, uint256 payout);
    event PriceUpdated(uint256 newPrice);
    event FundsDistributed();

    constructor(
        address _shareTokenAddress,
        address _paymentTokenAddress,
        uint256 _initialPricePerShare,
        uint256 _totalSharesForSale,
        address _founderAddress,
        address _investableFundsWallet,
        address _platformTreasury,
        address _daoTimelock,
        address _demoAdmin
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, _daoTimelock);
        _grantRole(DEMO_ADMIN_ROLE, _demoAdmin);
        
        shareToken = IERC20(_shareTokenAddress);
        paymentToken = IERC20(_paymentTokenAddress);
        pricePerShare = _initialPricePerShare;
        totalSharesForSale = _totalSharesForSale;
        founderAddress = _founderAddress;
        investableFundsWallet = _investableFundsWallet;
        platformTreasury = _platformTreasury;
    }

    // --- Public Functions (for Investors) ---

    function buyShares(uint256 numShares) external nonReentrant {
        require(sharesSold + numShares <= totalSharesForSale, "SaleTreasury: Not enough shares left");
        uint256 cost = (numShares * pricePerShare) / 1e18;
        sharesSold += numShares;

        paymentToken.safeTransferFrom(msg.sender, address(this), cost);
        shareToken.safeTransfer(msg.sender, numShares);

        emit SharesPurchased(msg.sender, numShares, cost);
    }
    
    function sellShares(uint256 numShares) external nonReentrant {
        require(pricePerShare > 0, "SaleTreasury: Buybacks are not active");
        
        uint256 payout = (numShares * pricePerShare) / 1e18;
        require(paymentToken.balanceOf(address(this)) >= payout, "SaleTreasury: Insufficient funds for buyback");

        // The user must first approve the contract to spend their shares.
        // Then, the contract pulls the shares from the user.
        shareToken.safeTransferFrom(msg.sender, address(this), numShares);
        
        paymentToken.safeTransfer(msg.sender, payout);
        
        emit SharesSoldBack(msg.sender, numShares, payout);
    }

    function distributeFunds() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 totalRaised = paymentToken.balanceOf(address(this));
        require(totalRaised > 0, "SaleTreasury: No funds to distribute");
        uint256 platformCut = (totalRaised * 20) / 100;
        uint256 founderCut = (totalRaised * 40) / 100;
        uint256 investableCut = totalRaised - platformCut - founderCut;
        paymentToken.safeTransfer(platformTreasury, platformCut);
        paymentToken.safeTransfer(founderAddress, founderCut);
        paymentToken.safeTransfer(investableFundsWallet, investableCut);
        emit FundsDistributed();
    }

    // --- Admin-Only Function ---

    function setPriceByAdmin(uint256 newPrice) external onlyRole(DEMO_ADMIN_ROLE) {
        require(newPrice > 0, "Price must be greater than zero");
        pricePerShare = newPrice;
        emit PriceUpdated(newPrice);
    }
}