// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet / test stand-in for the $CHOG token. Anyone can mint.
contract MockCHOG is ERC20 {
    constructor() ERC20("Mock CHOG", "mCHOG") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
