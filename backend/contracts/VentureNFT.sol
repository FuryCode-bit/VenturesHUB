// contracts/VentureNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VentureNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    constructor(address initialOwner)
        ERC721("VentureNFT", "VNFT")
        Ownable(initialOwner)
    {}

    function mint(address to, string memory tokenURI)
        public
        onlyOwner
        returns (uint256)
    {
        _tokenIdCounter++;
        uint256 newItemId = _tokenIdCounter;
        _safeMint(to, newItemId);
        _setTokenURI(newItemId, tokenURI);
        return newItemId;
    }
}