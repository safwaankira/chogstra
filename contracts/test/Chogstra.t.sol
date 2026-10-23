// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Chogstra} from "../src/Chogstra.sol";
import {MockChog} from "./mocks/MockChogNFT.sol";
import {MockCHOG} from "./mocks/MockChogToken.sol";

contract ChogstraTest is Test {
    Chogstra internal chogstra;
    MockChog internal nft;
    MockCHOG internal token;

    uint64 internal constant START = 1_800_000_000;
    uint256 internal constant TOKEN = 409; // "CHOG #1870" on mainnet: tokenId, not display number
    uint64 internal constant PATTERN = 0x8F0E_0000_8C00_0008;

    address internal owner = makeAddr("owner");
    address internal friend = makeAddr("friend");
    address internal buyer = makeAddr("buyer");
    address internal fan = makeAddr("fan");

    function setUp() public {
        nft = new MockChog();
        token = new MockCHOG();
        chogstra = new Chogstra(nft, token, START);
        nft.mint(owner, TOKEN);
        vm.warp(START);
        vm.roll(100);
    }

    function _toMovement(uint256 movement) internal {
        vm.warp(START + movement * 1 days + 1 hours);
        vm.roll(vm.getBlockNumber() + 1);
    }

    function _career(uint256 tokenId)
        internal
        view
        returns (uint32 performances, uint32 lastMovement, uint32 streak, uint64 applause)
    {
        (performances, lastMovement, streak,, applause) = chogstra.careers(tokenId);
    }

    // ------------------------------------------------------------------ perform

    function test_OwnerCanPerform() public {
        vm.expectEmit(address(chogstra));
        emit Chogstra.Performed(TOKEN, 0, PATTERN, owner);
        vm.prank(owner);
        chogstra.perform(TOKEN, PATTERN);

        (uint64 pattern, uint32 movement, uint32 updatedBlock) = chogstra.parts(TOKEN);
        assertEq(pattern, PATTERN);
        assertEq(movement, 0);
        assertEq(updatedBlock, 100);
        (uint32 performances,, uint32 streak,) = _career(TOKEN);
        assertEq(performances, 1);
        assertEq(streak, 1);
    }

    function test_NonOwnerReverts() public {
        vm.prank(friend);
        vm.expectRevert(Chogstra.NotOwnerOrDelegate.selector);
        chogstra.perform(TOKEN, PATTERN);
    }

    function test_NonexistentTokenReverts() public {
        vm.prank(owner);
        vm.expectRevert(); // ERC721NonexistentToken from the NFT
        chogstra.perform(9999, PATTERN);
    }

    function test_PerformBeforeStartReverts() public {
        vm.warp(START - 1);
        vm.prank(owner);
        vm.expectRevert(Chogstra.NotStarted.selector);
        chogstra.perform(TOKEN, PATTERN);
    }

    function test_TwoPerformsInOneMovementCountOnce() public {
        vm.startPrank(owner);
        chogstra.perform(TOKEN, PATTERN);
        vm.warp(START + 23 hours);
        chogstra.perform(TOKEN, 1);
        vm.stopPrank();

        (uint64 pattern,,) = chogstra.parts(TOKEN);
        assertEq(pattern, 1, "latest pattern wins");
        (uint32 performances, uint32 lastMovement, uint32 streak,) = _career(TOKEN);
        assertEq(performances, 1);
        assertEq(lastMovement, 0);
        assertEq(streak, 1);
    }

    function test_StreakGrowsOnConsecutiveMovements() public {
        vm.startPrank(owner);
        for (uint256 m = 0; m < 4; m++) {
            _toMovement(m);
            chogstra.perform(TOKEN, PATTERN);
        }
        vm.stopPrank();
        (uint32 performances, uint32 lastMovement, uint32 streak,) = _career(TOKEN);
        assertEq(performances, 4);
        assertEq(lastMovement, 3);
        assertEq(streak, 4);
    }

    function test_StreakResetsAfterGap() public {
        vm.startPrank(owner);
        _toMovement(0);
        chogstra.perform(TOKEN, PATTERN);
        _toMovement(1);
        chogstra.perform(TOKEN, PATTERN);
        _toMovement(3); // skipped movement 2
        chogstra.perform(TOKEN, PATTERN);
        vm.stopPrank();
        (uint32 performances, uint32 lastMovement, uint32 streak,) = _career(TOKEN);
        assertEq(performances, 3);
        assertEq(lastMovement, 3);
        assertEq(streak, 1);
    }

    function test_FirstPerformLaterThanMovementZero() public {
        // lastMovement defaults to 0; a first perform in movement 1 must not count as a streak of 2.
        _toMovement(1);
        vm.prank(owner);
        chogstra.perform(TOKEN, PATTERN);
        (,, uint32 streak,) = _career(TOKEN);
        assertEq(streak, 1);
    }

    function testFuzz_AnyPatternIsStoredExactly(uint64 pattern) public {
        vm.prank(owner);
        chogstra.perform(TOKEN, pattern);
        (uint64 stored,,) = chogstra.parts(TOKEN);
        assertEq(stored, pattern);
    }

    // ------------------------------------------------------------------ delegation

    function test_DelegateCanPerform() public {
        vm.prank(owner);
        chogstra.delegate(TOKEN, friend, START + 2 days);

        vm.expectEmit(address(chogstra));
        emit Chogstra.Performed(TOKEN, 0, PATTERN, friend);
        vm.prank(friend);
        chogstra.perform(TOKEN, PATTERN);
        (uint32 performances,,,) = _career(TOKEN);
        assertEq(performances, 1);
    }

    function test_DelegationEndsWhenChogIsTransferred() public {
        vm.startPrank(owner);
        chogstra.delegate(TOKEN, friend, START + 30 days);
        nft.transferFrom(owner, buyer, TOKEN);
        vm.stopPrank();

        assertFalse(chogstra.canPerform(friend, TOKEN));
        vm.prank(friend);
        vm.expectRevert(Chogstra.NotOwnerOrDelegate.selector);
        chogstra.perform(TOKEN, PATTERN);

        // Even if the Chog comes back, a sale in between...
        vm.prank(buyer);
        nft.transferFrom(buyer, owner, TOKEN);
        // ...the old grant revives only because ownerAtGrant matches again; that's the
        // documented rule ("current owner equals ownerAtGrant").
        assertTrue(chogstra.canPerform(friend, TOKEN));
    }

    function test_DelegationEndsAtExpiry() public {
        uint64 expiry = START + 1 days;
        vm.prank(owner);
        chogstra.delegate(TOKEN, friend, expiry);

        vm.warp(expiry - 1);
        assertTrue(chogstra.canPerform(friend, TOKEN));

        vm.warp(expiry);
        vm.prank(friend);
        vm.expectRevert(Chogstra.NotOwnerOrDelegate.selector);
        chogstra.perform(TOKEN, PATTERN);
    }

    function test_RevokeDelegation() public {
        vm.startPrank(owner);
        chogstra.delegate(TOKEN, friend, START + 2 days);
        chogstra.revokeDelegation(TOKEN);
        vm.stopPrank();
        assertFalse(chogstra.canPerform(friend, TOKEN));
    }

    function test_OnlyOwnerCanDelegate() public {
        vm.prank(friend);
        vm.expectRevert(Chogstra.NotOwner.selector);
        chogstra.delegate(TOKEN, friend, START + 1 days);

        vm.prank(friend);
        vm.expectRevert(Chogstra.NotOwner.selector);
        chogstra.revokeDelegation(TOKEN);
    }

    function test_DelegateRejectsBadInput() public {
        vm.startPrank(owner);
        vm.expectRevert(Chogstra.InvalidDelegation.selector);
        chogstra.delegate(TOKEN, address(0), START + 1 days);
        vm.expectRevert(Chogstra.InvalidDelegation.selector);
        chogstra.delegate(TOKEN, friend, START); // already expired
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ applause

    function test_ApplaudOncePerAddressPerMovement() public {
        vm.prank(owner);
        chogstra.perform(TOKEN, PATTERN);

        vm.expectEmit(address(chogstra));
        emit Chogstra.Applauded(TOKEN, 0, fan);
        vm.prank(fan);
        chogstra.applaud(TOKEN);

        vm.prank(fan);
        vm.expectRevert(Chogstra.AlreadyApplauded.selector);
        chogstra.applaud(TOKEN);

        vm.prank(friend); // a different fan can still applaud
        chogstra.applaud(TOKEN);

        // Next movement: needs a fresh part, then the same fan may applaud again.
        _toMovement(1);
        vm.prank(fan);
        vm.expectRevert(Chogstra.NoPartThisMovement.selector);
        chogstra.applaud(TOKEN);

        vm.prank(owner);
        chogstra.perform(TOKEN, PATTERN);
        vm.prank(fan);
        chogstra.applaud(TOKEN);

        (,,, uint64 applause) = _career(TOKEN);
        assertEq(applause, 3);
    }

    function test_ApplaudNeedsAPart() public {
        vm.prank(fan);
        vm.expectRevert(Chogstra.NoPartThisMovement.selector);
        chogstra.applaud(TOKEN); // movement 0, never performed
    }

    // ------------------------------------------------------------------ tips

    function test_TipSplitsExactly90_10() public {
        uint256 amount = 1_000 ether;
        token.mint(fan, amount);
        vm.prank(fan);
        token.approve(address(chogstra), amount);

        vm.expectEmit(address(chogstra));
        emit Chogstra.Tipped(TOKEN, 0, fan, owner, amount, 900 ether, 100 ether);
        vm.prank(fan);
        chogstra.tip(TOKEN, amount);

        assertEq(token.balanceOf(owner), 900 ether);
        assertEq(token.balanceOf(address(chogstra)), 100 ether);
        assertEq(chogstra.encorePot(0), 100 ether);
        assertEq(token.balanceOf(fan), 0);
    }

    function test_TipGoesToCurrentOwner() public {
        vm.prank(owner);
        nft.transferFrom(owner, buyer, TOKEN);
        token.mint(fan, 10 ether);
        vm.startPrank(fan);
        token.approve(address(chogstra), 10 ether);
        chogstra.tip(TOKEN, 10 ether);
        vm.stopPrank();
        assertEq(token.balanceOf(buyer), 9 ether);
        assertEq(token.balanceOf(owner), 0);
    }

    function testFuzz_TipSplitAlwaysAddsUp(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        token.mint(fan, amount);
        vm.startPrank(fan);
        token.approve(address(chogstra), amount);
        chogstra.tip(TOKEN, amount);
        vm.stopPrank();
        assertEq(token.balanceOf(owner) + token.balanceOf(address(chogstra)), amount);
        assertEq(token.balanceOf(owner), amount * 9 / 10);
    }

    function test_TipZeroReverts() public {
        vm.prank(fan);
        vm.expectRevert(Chogstra.ZeroAmount.selector);
        chogstra.tip(TOKEN, 0);
    }

    // ------------------------------------------------------------------ movements

    function test_CurrentMovement() public {
        assertEq(chogstra.currentMovement(), 0);
        vm.warp(START + 1 days - 1);
        assertEq(chogstra.currentMovement(), 0);
        vm.warp(START + 1 days);
        assertEq(chogstra.currentMovement(), 1);
        vm.warp(START + 10 days + 5);
        assertEq(chogstra.currentMovement(), 10);
    }

    // ------------------------------------------------------------------ gas

    /// Gas for perform() in its three real-world cases, printed with -vv.
    function test_GasPerform() public {
        uint256 other = 410;
        nft.mint(owner, other);

        vm.startPrank(owner);
        uint256 g = gasleft();
        chogstra.perform(TOKEN, PATTERN);
        emit log_named_uint("perform: first ever", g - gasleft());

        _toMovement(1);
        g = gasleft();
        chogstra.perform(TOKEN, PATTERN);
        emit log_named_uint("perform: next movement (streak+1)", g - gasleft());

        g = gasleft();
        chogstra.perform(TOKEN, 1);
        emit log_named_uint("perform: rewrite in same movement", g - gasleft());
        vm.stopPrank();
    }
}
