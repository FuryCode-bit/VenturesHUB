// contracts/FractionalizerVault.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FractionalizerVault is Ownable, IERC721Receiver {
    IERC721 public immutable nft;
    uint256 public immutable nftId;

    constructor(
        address _nftAddress,
        uint256 _nftId,
        address _initialOwner
    ) Ownable(_initialOwner) {
        nft = IERC721(_nftAddress);
        nftId = _nftId;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}