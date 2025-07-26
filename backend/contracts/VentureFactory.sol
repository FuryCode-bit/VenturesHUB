// contracts/VentureFactory.sol (Final Corrected Version)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./VentureNFT.sol";
import "./VentureShare.sol";
import "./FractionalizerVault.sol";
import "./SaleTreasury.sol";
import "./VentureDAO.sol";

contract VentureFactory is IERC721Receiver {
    VentureNFT public immutable ventureNFT;
    address public immutable paymentTokenAddress;
    address public immutable platformTreasury;

    event VentureCreated(
        uint256 indexed ventureId,
        address indexed founder,
        address shareToken,
        address vault,
        address saleTreasury,
        address dao,
        address timelock
    );
    event TokenCreated(address indexed shareToken);

    constructor(address _ventureNFTAddress, address _paymentTokenAddress, address _platformTreasury) {
        ventureNFT = VentureNFT(_ventureNFTAddress);
        paymentTokenAddress = _paymentTokenAddress;
        platformTreasury = _platformTreasury;
    }

    struct VentureEcosystemParams {
        address founderAddress;
        string tokenURI;
        uint256 totalShares;
        uint256 pricePerShare;
        address demoAdminAddress;
        address shareTokenAddress;
    }

    // --- TRANSACTION 1: Deploys the token and mints the supply to the factory ---
    function createShareToken(string memory name, string memory symbol, uint256 totalShares) external returns (address) {
        VentureShare shareToken = new VentureShare(name, symbol, address(this));
        shareToken.mint(address(this), totalShares);
        emit TokenCreated(address(shareToken));
        return address(shareToken);
    }

    // --- TRANSACTION 2: Deploys the rest of the ecosystem using the pre-minted tokens ---
    function createVentureEcosystem(VentureEcosystemParams memory params) external {
        console.log("--- Starting Venture Ecosystem Creation ---");
        VentureShare shareToken = VentureShare(params.shareTokenAddress);
        require(shareToken.owner() == address(this), "Factory must own the share token contract");
        require(shareToken.balanceOf(address(this)) == params.totalShares, "Factory must hold all shares");

        uint256 founderShare = (params.totalShares * 40) / 100;
        uint256 sharesForSale = (params.totalShares * 40) / 100;
        uint256 daoShare = params.totalShares - founderShare - sharesForSale;

        TimelockController timelock = new TimelockController(30, new address[](0), new address[](0), address(this));
        VentureDAO dao = new VentureDAO(shareToken, timelock, 1, 20, 0, 4);
        uint256 newNftId = ventureNFT.mint(address(this), params.tokenURI);
        FractionalizerVault vault = new FractionalizerVault(address(ventureNFT), newNftId, address(timelock));
        SaleTreasury treasury = new SaleTreasury(params.shareTokenAddress, paymentTokenAddress, params.pricePerShare, sharesForSale, params.founderAddress, address(timelock), platformTreasury, address(timelock), params.demoAdminAddress);

        shareToken.transfer(params.founderAddress, founderShare);
        shareToken.delegate(params.founderAddress);

        shareToken.transfer(address(treasury), sharesForSale);

        shareToken.transfer(platformTreasury, daoShare);
        shareToken.delegate(platformTreasury);
        bytes32 proposerRole = timelock.PROPOSER_ROLE();
        bytes32 executorRole = timelock.EXECUTOR_ROLE();
        bytes32 adminRole = 0x00; 
        timelock.grantRole(proposerRole, address(dao));
        timelock.grantRole(executorRole, address(0)); 

        ventureNFT.transferFrom(address(this), address(vault), newNftId);
        shareToken.transferOwnership(address(timelock)); 
        
        timelock.grantRole(adminRole, address(timelock));
        timelock.revokeRole(adminRole, address(this));

        emit VentureCreated(newNftId, params.founderAddress, params.shareTokenAddress, address(vault), address(treasury), address(dao), address(timelock));
        console.log("--- Venture Ecosystem Creation Finished Successfully! ---");
    }

    function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}