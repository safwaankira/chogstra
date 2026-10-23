// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Chogstra} from "../src/Chogstra.sol";
import {MockChog} from "./mocks/MockChogNFT.sol";
import {MockCHOG} from "./mocks/MockChogToken.sol";
import {MockEntropyV2} from "./mocks/MockEntropyV2.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";

contract ChogstraTest is Test {
    Chogstra internal chogstra;
    MockChog internal nft;
    MockCHOG internal token;
    MockEntropyV2 internal entropy;

    uint64 internal constant START = 1_800_000_000;
    uint256 internal constant TOKEN = 409; // "CHOG #1870" on mainnet: tokenId, not display number
    uint64 internal constant PATTERN = 0x8F0E_0000_8C00_0008;
    uint128 internal constant FEE = 0.01 ether;

    address internal owner = makeAddr("owner");
    address internal friend = makeAddr("friend");
    address internal buyer = makeAddr("buyer");
    address internal fan = makeAddr("fan");

    function setUp() public {
        nft = new MockChog();
        token = new MockCHOG();
        entropy = new MockEntropyV2(FEE);
        chogstra = new Chogstra(nft, token, IEntropyV2(address(entropy)), START);
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

    // ------------------------------------------------------------------ self-applause

    function test_SelfApplauseReverts() public {
        vm.startPrank(owner);
        chogstra.perform(TOKEN, PATTERN);
        vm.expectRevert(Chogstra.SelfApplause.selector);
        chogstra.applaud(TOKEN);
        vm.stopPrank();
    }

    function test_DelegateCanApplaudButOwnerCannot() public {
        // The rule is "not the current owner"; a delegate is someone else.
        vm.prank(owner);
        chogstra.delegate(TOKEN, friend, START + 2 days);
        vm.prank(friend);
        chogstra.perform(TOKEN, PATTERN);
        vm.prank(owner);
        vm.expectRevert(Chogstra.SelfApplause.selector);
        chogstra.applaud(TOKEN);
    }

    // ------------------------------------------------------------------ performedIn

    function test_PerformMarksPerformedIn() public {
        assertFalse(chogstra.performedIn(0, TOKEN));
        vm.prank(owner);
        chogstra.perform(TOKEN, PATTERN);
        assertTrue(chogstra.performedIn(0, TOKEN));
        assertFalse(chogstra.performedIn(1, TOKEN));
    }

    // ------------------------------------------------------------------ closeMovement

    address internal closer = makeAddr("closer");

    function _close(uint32 movement) internal returns (uint64 sequence) {
        vm.deal(closer, 1 ether);
        vm.prank(closer);
        chogstra.closeMovement{value: FEE}(movement);
        (,,, sequence) = chogstra.closings(movement);
    }

    function _closeAndSeed(uint32 movement, bytes32 seed) internal {
        uint64 sequence = _close(movement);
        entropy.mockReveal(sequence, seed);
    }

    function test_CloseMovementOnlyAfterItEnds() public {
        vm.deal(closer, 1 ether);
        vm.prank(closer);
        vm.expectRevert(Chogstra.MovementNotOver.selector);
        chogstra.closeMovement{value: FEE}(0);

        vm.warp(START + 1 days - 1);
        vm.prank(closer);
        vm.expectRevert(Chogstra.MovementNotOver.selector);
        chogstra.closeMovement{value: FEE}(0);

        vm.warp(START + 1 days);
        vm.prank(closer);
        chogstra.closeMovement{value: FEE}(0);
        (bool closed, bool seeded,,) = chogstra.closings(0);
        assertTrue(closed);
        assertFalse(seeded);
    }

    function test_CloseMovementOnlyOnce() public {
        _toMovement(1);
        _close(0);
        vm.prank(closer);
        vm.expectRevert(Chogstra.AlreadyClosed.selector);
        chogstra.closeMovement{value: FEE}(0);
    }

    function test_CloseMovementPaysFeeAndRefundsExtra() public {
        _toMovement(1);
        vm.deal(closer, 1 ether);

        vm.prank(closer);
        vm.expectRevert(abi.encodeWithSelector(Chogstra.InsufficientFee.selector, uint256(FEE)));
        chogstra.closeMovement{value: FEE - 1}(0);

        vm.expectEmit(address(chogstra));
        emit Chogstra.MovementClosed(0, 1, closer, FEE);
        vm.prank(closer);
        chogstra.closeMovement{value: 0.5 ether}(0);

        assertEq(address(entropy).balance, FEE, "entropy got exactly the fee");
        assertEq(closer.balance, 1 ether - FEE, "extra refunded");
        assertEq(address(chogstra).balance, 0, "nothing stuck in Chogstra");
    }

    // ------------------------------------------------------------------ entropy callback

    function test_CallbackStoresSeed() public {
        _toMovement(1);
        uint64 sequence = _close(0);
        bytes32 seed = keccak256("movement zero");

        vm.expectEmit(address(chogstra));
        emit Chogstra.MovementSeeded(0, seed);
        entropy.mockReveal(sequence, seed);

        assertEq(chogstra.seeds(0), seed);
        (, bool seeded,,) = chogstra.closings(0);
        assertTrue(seeded);
    }

    function test_OnlyEntropyCanCallBack() public {
        _toMovement(1);
        uint64 sequence = _close(0);
        vm.prank(fan);
        vm.expectRevert("Only Entropy can call this function");
        chogstra._entropyCallback(sequence, address(entropy), bytes32(uint256(1)));
        assertEq(chogstra.seeds(0), bytes32(0));
    }

    function test_CallbackRejectsUnknownSequence() public {
        _toMovement(1);
        _close(0); // sequence 1
        vm.prank(address(entropy));
        vm.expectRevert(Chogstra.UnknownSequence.selector);
        chogstra._entropyCallback(99, address(entropy), bytes32(uint256(1)));
    }

    // ------------------------------------------------------------------ settingFor

    function test_SettingForMovementZeroIsDefault() public view {
        (uint8 key, uint8 tempo, uint8 mood) = chogstra.settingFor(0);
        assertEq(key, 0);
        assertEq(tempo, 90);
        assertEq(mood, 0);
    }

    function test_SettingForNeedsPreviousSeed() public {
        vm.expectRevert(Chogstra.SeedNotReady.selector);
        chogstra.settingFor(1);
        _toMovement(1);
        _close(0);
        vm.expectRevert(Chogstra.SeedNotReady.selector);
        chogstra.settingFor(1); // closed but not seeded yet
    }

    function testFuzz_SettingForIsInRange(bytes32 seed) public {
        _toMovement(1);
        _closeAndSeed(0, seed);
        (uint8 key, uint8 tempo, uint8 mood) = chogstra.settingFor(1);
        assertLt(key, 12);
        assertGe(tempo, 80);
        assertLe(tempo, 110);
        assertLt(mood, 4);
    }

    // ------------------------------------------------------------------ spotlight

    bytes32 internal constant SEED = keccak256("chogstra spotlight seed");

    function _drawAt(bytes32 seed, uint256 i) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, i))) % 1969 + 1;
    }

    /// Mint `tokenId` to its own owner address (if new) and perform with it in the current movement.
    function _mintAndPerform(uint256 tokenId) internal returns (address who) {
        who = address(uint160(0xC0FFEE0000 + tokenId));
        try nft.ownerOf(tokenId) returns (address existing) {
            who = existing;
        } catch {
            nft.mint(who, tokenId);
        }
        vm.prank(who);
        chogstra.perform(tokenId, PATTERN);
    }

    function _tipPot(uint256 potAmount) internal {
        uint256 amount = potAmount * 10; // 10% of a tip lands in the pot
        token.mint(fan, amount);
        vm.startPrank(fan);
        token.approve(address(chogstra), amount);
        chogstra.tip(TOKEN, amount);
        vm.stopPrank();
    }

    /// The first 6 distinct draws for SEED, so tests can choose who "gets drawn".
    function _distinctDraws(uint256 n) internal pure returns (uint256[] memory ids, uint256[] memory drawIndex) {
        ids = new uint256[](n);
        drawIndex = new uint256[](n);
        uint256 found;
        for (uint256 i = 0; found < n; i++) {
            uint256 id = _drawAt(SEED, i);
            bool dup;
            for (uint256 j = 0; j < found; j++) {
                if (ids[j] == id) dup = true;
            }
            if (!dup && id != TOKEN) {
                ids[found] = id;
                drawIndex[found++] = i;
            }
        }
    }

    function test_SpotlightPicksOnlyPerformersAtMostThree() public {
        (uint256[] memory ids,) = _distinctDraws(6);
        // Draws 0 and 2 are minted but stay silent; 1, 3, 4, 5 perform.
        nft.mint(makeAddr("silent0"), ids[0]);
        nft.mint(makeAddr("silent2"), ids[2]);
        address p1 = _mintAndPerform(ids[1]);
        address p3 = _mintAndPerform(ids[3]);
        address p4 = _mintAndPerform(ids[4]);
        _mintAndPerform(ids[5]);
        _tipPot(90 ether);

        _toMovement(1);
        _closeAndSeed(0, SEED);
        chogstra.resolveSpotlight(0);

        // Winners: the first three performers in draw order.
        (,,, uint32 s1,) = chogstra.careers(ids[1]);
        (,,, uint32 s3,) = chogstra.careers(ids[3]);
        (,,, uint32 s4,) = chogstra.careers(ids[4]);
        (,,, uint32 s5,) = chogstra.careers(ids[5]);
        (,,, uint32 s0,) = chogstra.careers(ids[0]);
        (,,, uint32 s2,) = chogstra.careers(ids[2]);
        assertEq(s1 + s3 + s4, 3, "first three performers drawn");
        assertEq(s5, 0, "fourth performer not drawn: max 3");
        assertEq(s0 + s2, 0, "non-performers never drawn");

        assertEq(token.balanceOf(p1), 30 ether);
        assertEq(token.balanceOf(p3), 30 ether);
        assertEq(token.balanceOf(p4), 30 ether);
        assertEq(chogstra.encorePot(0), 0);
    }

    function test_SpotlightSplitRoundsIntoNextPot() public {
        (uint256[] memory ids,) = _distinctDraws(3);
        address a = _mintAndPerform(ids[0]);
        address b = _mintAndPerform(ids[1]);
        address c = _mintAndPerform(ids[2]);
        _tipPot(100 ether); // 100e18 / 3 leaves 1 wei

        _toMovement(1);
        _closeAndSeed(0, SEED);
        chogstra.resolveSpotlight(0);

        uint256 share = uint256(100 ether) / 3;
        assertEq(token.balanceOf(a), share);
        assertEq(token.balanceOf(b), share);
        assertEq(token.balanceOf(c), share);
        assertEq(chogstra.encorePot(0), 0);
        assertEq(chogstra.encorePot(1), 1, "1 wei of dust rolls into the current movement");
        assertEq(token.balanceOf(address(chogstra)), 1);
    }

    function test_SpotlightPaysCurrentOwner() public {
        (uint256[] memory ids,) = _distinctDraws(1);
        address seller = _mintAndPerform(ids[0]);
        _tipPot(10 ether);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, ids[0]);

        _toMovement(1);
        _closeAndSeed(0, SEED);
        chogstra.resolveSpotlight(0);
        assertEq(token.balanceOf(buyer), 10 ether);
        assertEq(token.balanceOf(seller), 0);
    }

    function test_SpotlightRollsPotOverWhenNobodyPerformed() public {
        _tipPot(50 ether);
        _toMovement(1);
        _closeAndSeed(0, SEED);

        vm.expectEmit(address(chogstra));
        emit Chogstra.SpotlightResolved(0, 0, 0, 50 ether, 1);
        chogstra.resolveSpotlight(0);
        assertEq(chogstra.encorePot(0), 0);
        assertEq(chogstra.encorePot(1), 50 ether);
    }

    function test_RolloverNeverLandsInAResolvedMovement() public {
        // Movement 0 is resolved late, after movement 1 was already resolved:
        // its pot goes to the current movement (2), not to resolved movement 1.
        _tipPot(20 ether);
        _toMovement(2);
        _closeAndSeed(0, SEED);
        _closeAndSeed(1, keccak256("one"));
        chogstra.resolveSpotlight(1);
        chogstra.resolveSpotlight(0);
        assertEq(chogstra.encorePot(1), 0);
        assertEq(chogstra.encorePot(2), 20 ether);
    }

    function test_ResolveSpotlightNeedsSeedAndOnlyOnce() public {
        _toMovement(1);
        vm.expectRevert(Chogstra.SeedNotReady.selector);
        chogstra.resolveSpotlight(0);
        _close(0);
        vm.expectRevert(Chogstra.SeedNotReady.selector);
        chogstra.resolveSpotlight(0);

        (, bool seeded,,) = chogstra.closings(0);
        assertFalse(seeded);
        (,,, uint64 sequence) = chogstra.closings(0);
        entropy.mockReveal(sequence, SEED);
        chogstra.resolveSpotlight(0);
        vm.expectRevert(Chogstra.AlreadyResolved.selector);
        chogstra.resolveSpotlight(0);
    }

    // ------------------------------------------------------------------ gas: close + spotlight

    /// Worst case for resolveSpotlight: nobody performed, so all 256 draws run.
    function test_GasResolveSpotlightWorstCase() public {
        _tipPot(10 ether);
        _toMovement(1);
        _closeAndSeed(0, SEED);
        chogstra.resolveSpotlight(0);
    }

    /// Typical case: three performers drawn early, pot paid to three owners.
    function test_GasResolveSpotlightThreeWinners() public {
        (uint256[] memory ids,) = _distinctDraws(3);
        for (uint256 i = 0; i < 3; i++) {
            _mintAndPerform(ids[i]);
        }
        _tipPot(30 ether);
        _toMovement(1);
        _closeAndSeed(0, SEED);
        chogstra.resolveSpotlight(0);
    }
}

