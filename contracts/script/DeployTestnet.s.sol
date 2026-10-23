// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import {Chogstra} from "../src/Chogstra.sol";
import {MockChog} from "../test/mocks/MockChogNFT.sol";
import {MockCHOG} from "../test/mocks/MockChogToken.sol";
import {MockEntropyV2} from "../test/mocks/MockEntropyV2.sol";

/// @notice Monad testnet demo: MockChog (same tokenIds as Chog Genesis), mock $CHOG,
/// MockEntropyV2 (Pyth Entropy's testnet address doesn't answer V2 calls) and Chogstra,
/// starting movement 0 now. Mints the deployer a small band to play with.
///
///   forge script script/DeployTestnet.s.sol:DeployTestnet \
///     --rpc-url https://testnet-rpc.monad.xyz --broadcast --interactives 1
contract DeployTestnet is Script {
    // Same tokenIds the local dev chain hands out: Halo (1:1 Legendary), a Skull, two Commons.
    uint256[4] internal STARTER_CHOGS = [uint256(1667), 61, 3, 4];
    uint256 internal constant STARTER_CHOG_TOKENS = 10_000 ether;

    function run() external {
        vm.startBroadcast();
        // The wallet actually broadcasting (msg.sender inside a script is the script contract's caller, not the signer).
        (, address deployer,) = vm.readCallers();

        MockChog nft = new MockChog();
        MockCHOG token = new MockCHOG();
        MockEntropyV2 entropy = new MockEntropyV2(0);
        // forge-lint: disable-next-line(unsafe-typecast)
        Chogstra chogstra = new Chogstra(IERC721(address(nft)), IERC20(address(token)), IEntropyV2(address(entropy)), uint64(block.timestamp));

        for (uint256 i = 0; i < STARTER_CHOGS.length; i++) {
            nft.mint(deployer, STARTER_CHOGS[i]);
        }
        token.mint(deployer, STARTER_CHOG_TOKENS);
        vm.stopBroadcast();

        console2.log("NEXT_PUBLIC_CHAIN_ID=10143");
        console2.log("NEXT_PUBLIC_CHOGSTRA_ADDRESS=%s", address(chogstra));
        console2.log("NEXT_PUBLIC_CHOG_NFT_ADDRESS=%s", address(nft));
        console2.log("NEXT_PUBLIC_CHOG_TOKEN_ADDRESS=%s", address(token));
        console2.log("NEXT_PUBLIC_ENTROPY_ADDRESS=%s", address(entropy));
        console2.log("deployer (owns Chogs 1667, 61, 3, 4 and 10,000 mCHOG): %s", deployer);
    }
}
