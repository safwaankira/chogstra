// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Testnet / test stand-in for Chog Genesis. Anyone can mint any tokenId.
contract MockChog is ERC721 {
    constructor() ERC721("Mock Chog Genesis", "mCHOGNFT") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}
