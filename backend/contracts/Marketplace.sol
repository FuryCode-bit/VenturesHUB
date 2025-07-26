// contracts/Marketplace.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract Marketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken; 

    struct Listing {
        address seller;
        IERC20 shareToken;
        uint256 amount;
        uint256 pricePerShare; 
    }

    mapping(uint256 => Listing) public listings;
    uint256 private _listingIdCounter;

    event Listed(uint256 indexed listingId, address indexed seller, address indexed shareToken, uint256 amount, uint256 pricePerShare);
    event Sold(uint256 indexed listingId, address indexed buyer, uint256 totalCost);
    event Cancelled(uint256 indexed listingId);

    constructor(address _paymentTokenAddress) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentTokenAddress);
    }

    function listShares(address _shareTokenAddress, uint256 _amount, uint256 _pricePerShare) external {
        require(_amount > 0, "Amount must be greater than 0");
        
        // 1. Seller transfers their shares to this marketplace contract for escrow
        IERC20 shareToken = IERC20(_shareTokenAddress);
        shareToken.safeTransferFrom(msg.sender, address(this), _amount);

        // 2. Create the new listing
        _listingIdCounter++;
        uint256 newListingId = _listingIdCounter;
        listings[newListingId] = Listing({
            seller: msg.sender,
            shareToken: shareToken,
            amount: _amount,
            pricePerShare: _pricePerShare
        });

        emit Listed(newListingId, msg.sender, _shareTokenAddress, _amount, _pricePerShare);
    }
    
    // A buyer calls this to purchase an entire listing
    function buyShares(uint256 _listingId) external nonReentrant {
        Listing storage listing = listings[_listingId];
        require(listing.seller != address(0), "Listing does not exist");

        // The pricePerShare is already in the payment token's smallest unit (e.g., 1 USDC = 1,000,000).
        // The share amount has 18 decimals, so we normalize it before multiplying.
        uint8 shareDecimals = IERC20Metadata(address(listing.shareToken)).decimals();
        uint256 totalCost = (listing.amount * listing.pricePerShare) / (10 ** shareDecimals);
        
        // 1. Buyer pays by transferring USDC to this contract
        paymentToken.safeTransferFrom(msg.sender, address(this), totalCost);
        
        // 2. Marketplace sends the escrowed shares to the buyer
        listing.shareToken.safeTransfer(msg.sender, listing.amount);
        
        // 3. Marketplace sends the USDC payment to the seller
        paymentToken.safeTransfer(listing.seller, totalCost);

        emit Sold(_listingId, msg.sender, totalCost);
        
        delete listings[_listingId];
    }
    
    // The original seller can cancel their listing to get their shares back
    function cancelListing(uint256 _listingId) external {
        Listing storage listing = listings[_listingId];
        require(listing.seller == msg.sender, "Not the owner of the listing");

        // Return the escrowed shares to the seller
        listing.shareToken.safeTransfer(listing.seller, listing.amount);

        emit Cancelled(_listingId);

        delete listings[_listingId];
    }
}