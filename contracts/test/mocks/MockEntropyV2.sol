// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

/// @notice Test stand-in for Pyth Entropy V2: a settable fee, and `mockReveal`
/// so a test can deliver the random number. Only implements what Chogstra calls.
/// (The SDK's own MockEntropy always reports a fee of 0, so it can't test fees.)
contract MockEntropyV2 {
    uint128 public fee;
    uint64 public nextSequence = 1;
    mapping(uint64 sequence => address requester) public requesters;

    constructor(uint128 fee_) {
        fee = fee_;
    }

    function getFeeV2() external view returns (uint128) {
        return fee;
    }

    function requestV2() external payable returns (uint64 sequence) {
        require(msg.value >= fee, "fee");
        sequence = nextSequence++;
        requesters[sequence] = msg.sender;
    }

    function mockReveal(uint64 sequence, bytes32 randomNumber) external {
        address requester = requesters[sequence];
        require(requester != address(0), "unknown request");
        IEntropyConsumer(requester)._entropyCallback(sequence, address(this), randomNumber);
    }
}
