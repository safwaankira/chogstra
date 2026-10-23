// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import {Chogstra} from "../src/Chogstra.sol";

/// @notice Deploys Chogstra. Every constructor argument comes from the environment:
///   CHOG_NFT     Chog Genesis (ERC-721)
///   CHOG_TOKEN   $CHOG (ERC-20)
///   ENTROPY      Pyth Entropy V2 (or MockEntropyV2 on a local fork)
///   START_TIME   unix seconds when movement 0 begins
/// Local fork: scripts/dev-chain.sh runs this for you.
contract Deploy is Script {
    function run() external returns (Chogstra chogstra) {
        address chogNft = vm.envAddress("CHOG_NFT");
        address chogToken = vm.envAddress("CHOG_TOKEN");
        address entropy = vm.envAddress("ENTROPY");
        uint256 startTime = vm.envUint("START_TIME");
        require(startTime <= type(uint64).max, "START_TIME too large");
        require(chogNft.code.length > 0 && chogToken.code.length > 0 && entropy.code.length > 0, "address has no code");

        vm.startBroadcast();
        // forge-lint: disable-next-line(unsafe-typecast)
        chogstra = new Chogstra(IERC721(chogNft), IERC20(chogToken), IEntropyV2(entropy), uint64(startTime));
        vm.stopBroadcast();

        console2.log("Chogstra deployed at", address(chogstra));
        console2.log("  chogNft  ", chogNft);
        console2.log("  chogToken", chogToken);
        console2.log("  entropy  ", entropy);
        console2.log("  startTime", startTime);
    }
}
