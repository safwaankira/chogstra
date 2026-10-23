// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

/// @title Chogstra: 1,969 Chogs, one live onchain song.
/// @notice Every Chog holder writes a 16-step loop for their Chog. All current
/// loops play together as one song. The song is split into 24h Movements.
/// When a Movement ends, anyone can close it: Pyth Entropy returns a random seed
/// that sets the next Movement's key, tempo and mood and draws up to three
/// Spotlight Chogs, who share that Movement's Encore Pot.
/// @dev Monad executes transactions in parallel. `perform` only writes storage
/// keyed by its own tokenId (parts, careers, performedIn), so performs for
/// different Chogs in the same block never conflict. Totals across Chogs come
/// from the indexer.
contract Chogstra is IEntropyConsumer {
    using SafeERC20 for IERC20;

    /// @notice A Chog's current loop.
    /// @dev pattern: 16 steps x 4 bits. Step i = bits [4i, 4i+3]:
    /// bit 3 = note on/off, bits 0-2 = scale degree 0-7. Every uint64 is valid.
    struct Part {
        uint64 pattern;
        uint32 movement;
        uint32 updatedBlock; // 0 = never performed
    }

    struct Career {
        uint32 performances; // movements performed in (max one per movement)
        uint32 lastMovement;
        uint32 streak; // consecutive movements performed
        uint32 spotlights; // times drawn as a Spotlight Chog
        uint64 applause;
    }

    struct Delegation {
        address to;
        uint64 expiry; // valid while block.timestamp < expiry
        address ownerAtGrant; // selling the Chog cancels the delegation
    }

    /// @dev Lifecycle of one Movement after it ends: closed -> seeded -> resolved.
    struct Closing {
        bool closed; // Entropy requested
        bool seeded; // Entropy callback arrived, seeds[movement] is set
        bool resolved; // Spotlight drawn and pot paid out
        uint64 sequence; // Entropy sequence number
    }

    uint256 public constant MOVEMENT_LENGTH = 1 days;
    uint256 public constant OWNER_SHARE_BPS = 9_000; // 90% of a tip to the owner
    uint256 private constant BPS = 10_000;

    uint256 public constant COLLECTION_SIZE = 1969; // Chog Genesis tokenIds 1..1969
    uint256 public constant MAX_SPOTLIGHTS = 3;
    /// @dev 2048 draws find at least one of 5 performers ~99.5% of the time.
    /// Worst case (nobody performed): ~4.3M gas in Foundry, ~12.2M on Monad once
    /// its +6,000 per cold storage read is added (~1,270 distinct tokenIds get
    /// read). That's under half of Monad's 30M per-transaction gas limit.
    uint256 public constant MAX_DRAWS = 2048;

    // Musical setting. Movement 0 has no previous seed, so it uses these.
    uint8 public constant DEFAULT_KEY = 0; // C
    uint8 public constant DEFAULT_TEMPO = 90;
    uint8 public constant DEFAULT_MOOD = 0;
    uint8 public constant MIN_TEMPO = 80;
    uint8 public constant MAX_TEMPO = 110;
    uint8 public constant MOODS = 4;

    IERC721 public immutable chogNft;
    IERC20 public immutable chogToken;
    IEntropyV2 public immutable entropy;
    uint64 public immutable startTime;

    mapping(uint256 tokenId => Part) public parts;
    mapping(uint256 tokenId => Career) public careers;
    mapping(uint256 tokenId => Delegation) public delegations;
    mapping(uint256 movement => mapping(uint256 tokenId => mapping(address fan => bool))) public hasApplauded;
    /// @notice The 10% of tips kept per movement, for that movement's Spotlight Chogs.
    mapping(uint256 movement => uint256) public encorePot;
    /// @notice Which Chogs performed in a movement. One slot per Chog per movement.
    mapping(uint32 movement => mapping(uint256 tokenId => bool)) public performedIn;

    mapping(uint32 movement => Closing) public closings;
    mapping(uint32 movement => bytes32) public seeds;
    mapping(uint64 sequence => uint32 movement) public movementOfSequence;

    event Performed(uint256 indexed tokenId, uint32 indexed movement, uint64 pattern, address indexed performer);
    event Delegated(uint256 indexed tokenId, address indexed owner, address indexed to, uint64 expiry);
    event DelegationRevoked(uint256 indexed tokenId, address indexed owner);
    event Applauded(uint256 indexed tokenId, uint32 indexed movement, address indexed fan);
    event Tipped(
        uint256 indexed tokenId,
        uint32 indexed movement,
        address indexed tipper,
        address owner,
        uint256 amount,
        uint256 toOwner,
        uint256 toEncorePot
    );
    event MovementClosed(uint32 indexed movement, uint64 sequence, address indexed closer, uint256 fee);
    event MovementSeeded(uint32 indexed movement, bytes32 seed);
    event Spotlighted(uint32 indexed movement, uint256 indexed tokenId, address indexed owner, uint256 payout);
    event SpotlightResolved(
        uint32 indexed movement, uint256 winners, uint256 paidOut, uint256 rolledOver, uint32 rolledInto
    );

    error NotStarted();
    error NotOwnerOrDelegate();
    error NotOwner();
    error InvalidDelegation();
    error NoPartThisMovement();
    error AlreadyApplauded();
    error SelfApplause();
    error ZeroAmount();
    error MovementNotOver();
    error AlreadyClosed();
    error InsufficientFee(uint256 required);
    error RefundFailed();
    error UnknownSequence();
    error SeedNotReady();
    error AlreadyResolved();

    constructor(IERC721 chogNft_, IERC20 chogToken_, IEntropyV2 entropy_, uint64 startTime_) {
        chogNft = chogNft_;
        chogToken = chogToken_;
        entropy = entropy_;
        startTime = startTime_;
    }

    // ---------------------------------------------------------------------
    // Movements
    // ---------------------------------------------------------------------

    /// @notice The current 24h Movement, counting from 0 at startTime.
    function currentMovement() public view returns (uint32) {
        if (block.timestamp < startTime) revert NotStarted();
        // uint32 movements last ~11.7 million years.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32((block.timestamp - startTime) / MOVEMENT_LENGTH);
    }

    /// @notice Musical setting for a movement. Movement N is set by the seed of
    /// movement N-1; movement 0 uses the defaults (C, 90 bpm, mood 0).
    /// @dev Reverts with SeedNotReady until movement N-1 has been closed and seeded.
    /// @return keyIndex 0-11, semitones above C.
    /// @return tempo 80-110 bpm.
    /// @return moodIndex 0-3.
    function settingFor(uint32 movement) external view returns (uint8 keyIndex, uint8 tempo, uint8 moodIndex) {
        if (movement == 0) return (DEFAULT_KEY, DEFAULT_TEMPO, DEFAULT_MOOD);
        if (!closings[movement - 1].seeded) revert SeedNotReady();
        uint256 r = uint256(keccak256(abi.encode(seeds[movement - 1], "setting")));
        // Each value comes from a different byte range of r, all results fit in uint8.
        // forge-lint: disable-next-line(unsafe-typecast)
        keyIndex = uint8(r % 12);
        // forge-lint: disable-next-line(unsafe-typecast)
        tempo = uint8(MIN_TEMPO + (r >> 64) % (MAX_TEMPO - MIN_TEMPO + 1));
        // forge-lint: disable-next-line(unsafe-typecast)
        moodIndex = uint8((r >> 128) % MOODS);
    }

    // ---------------------------------------------------------------------
    // Perform
    // ---------------------------------------------------------------------

    /// @notice Write (or rewrite) a Chog's loop for the current Movement.
    /// @dev Counts at most one performance per Movement. Rewriting a loop in the
    /// same Movement only replaces the pattern.
    function perform(uint256 tokenId, uint64 pattern) external {
        if (!canPerform(msg.sender, tokenId)) revert NotOwnerOrDelegate();
        uint32 movement = currentMovement();

        Career storage career = careers[tokenId];
        bool firstEver = career.performances == 0;
        if (firstEver || career.lastMovement != movement) {
            if (!firstEver && career.lastMovement + 1 == movement) {
                career.streak += 1;
            } else {
                career.streak = 1;
            }
            career.performances += 1;
            career.lastMovement = movement;
            performedIn[movement][tokenId] = true;
        }

        // uint32 block numbers last ~54 years at Monad's 400ms blocks.
        // forge-lint: disable-next-line(unsafe-typecast)
        parts[tokenId] = Part({pattern: pattern, movement: movement, updatedBlock: uint32(block.number)});

        emit Performed(tokenId, movement, pattern, msg.sender);
    }

    /// @notice True if `account` owns the Chog or holds a live delegation for it.
    function canPerform(address account, uint256 tokenId) public view returns (bool) {
        address owner = chogNft.ownerOf(tokenId); // reverts for tokens that don't exist
        if (account == owner) return true;
        Delegation memory d = delegations[tokenId];
        return d.to == account && block.timestamp < d.expiry && d.ownerAtGrant == owner;
    }

    // ---------------------------------------------------------------------
    // Delegation
    // ---------------------------------------------------------------------

    /// @notice Lend your Chog's play rights to a friend until `expiry`.
    /// Replaces any earlier delegation. Ends early if you transfer the Chog.
    function delegate(uint256 tokenId, address to, uint64 expiry) external {
        if (chogNft.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (to == address(0) || to == msg.sender || expiry <= block.timestamp) revert InvalidDelegation();
        delegations[tokenId] = Delegation({to: to, expiry: expiry, ownerAtGrant: msg.sender});
        emit Delegated(tokenId, msg.sender, to, expiry);
    }

    function revokeDelegation(uint256 tokenId) external {
        if (chogNft.ownerOf(tokenId) != msg.sender) revert NotOwner();
        delete delegations[tokenId];
        emit DelegationRevoked(tokenId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Applause and tips
    // ---------------------------------------------------------------------

    /// @notice Applaud a Chog that has a part in the current Movement. Once per
    /// address per Chog per Movement, and never your own Chog.
    function applaud(uint256 tokenId) external {
        uint32 movement = currentMovement();
        Part storage part = parts[tokenId];
        if (part.updatedBlock == 0 || part.movement != movement) revert NoPartThisMovement();
        if (chogNft.ownerOf(tokenId) == msg.sender) revert SelfApplause();
        if (hasApplauded[movement][tokenId][msg.sender]) revert AlreadyApplauded();

        hasApplauded[movement][tokenId][msg.sender] = true;
        careers[tokenId].applause += 1;
        emit Applauded(tokenId, movement, msg.sender);
    }

    /// @notice Tip a Chog in $CHOG: 90% goes straight to its current owner, 10%
    /// stays here in this Movement's Encore Pot. Needs a $CHOG approval first.
    /// @dev The pot share is `amount - toOwner`, so rounding dust goes to the pot
    /// and the two parts always add up to `amount`.
    function tip(uint256 tokenId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint32 movement = currentMovement();
        address owner = chogNft.ownerOf(tokenId);

        uint256 toOwner = (amount * OWNER_SHARE_BPS) / BPS;
        uint256 toPot = amount - toOwner;
        encorePot[movement] += toPot;

        chogToken.safeTransferFrom(msg.sender, owner, toOwner);
        chogToken.safeTransferFrom(msg.sender, address(this), toPot);

        emit Tipped(tokenId, movement, msg.sender, owner, amount, toOwner, toPot);
    }

    // ---------------------------------------------------------------------
    // Closing a movement (Pyth Entropy)
    // ---------------------------------------------------------------------

    /// @notice Close a movement that has ended and request its random seed from
    /// Pyth Entropy. Anyone can call it, once per movement. Send at least
    /// `entropy.getFeeV2()` in MON; anything above the fee is refunded.
    function closeMovement(uint32 movement) external payable {
        if (movement >= currentMovement()) revert MovementNotOver();
        Closing storage c = closings[movement];
        if (c.closed) revert AlreadyClosed();

        uint256 fee = entropy.getFeeV2();
        if (msg.value < fee) revert InsufficientFee(fee);

        c.closed = true;
        uint64 sequence = entropy.requestV2{value: fee}();
        c.sequence = sequence;
        movementOfSequence[sequence] = movement;
        emit MovementClosed(movement, sequence, msg.sender, fee);

        uint256 refund = msg.value - fee;
        if (refund > 0) {
            (bool ok,) = msg.sender.call{value: refund}("");
            if (!ok) revert RefundFailed();
        }
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    /// @dev Called by Entropy via IEntropyConsumer._entropyCallback, which already
    /// checks msg.sender == entropy. Kept cheap on purpose: store the seed, emit.
    function entropyCallback(uint64 sequence, address, bytes32 randomNumber) internal override {
        uint32 movement = movementOfSequence[sequence];
        Closing storage c = closings[movement];
        if (!c.closed || c.sequence != sequence) revert UnknownSequence();
        if (c.seeded) return; // already have it; never overwrite a seed

        c.seeded = true;
        seeds[movement] = randomNumber;
        emit MovementSeeded(movement, randomNumber);
    }

    // ---------------------------------------------------------------------
    // Spotlight
    // ---------------------------------------------------------------------

    /// @notice Draw up to three Spotlight Chogs for a seeded movement and split
    /// its Encore Pot between their current owners. Anyone can call it, once.
    /// @dev Draw i picks tokenId keccak256(seed, i) % 1969 + 1 and keeps it if
    /// that Chog performed in the movement. Up to MAX_DRAWS draws. Leftover pot
    /// (rounding dust, or everything if nobody was drawn) rolls into the current
    /// movement's pot, which can't have been resolved yet, so nothing gets stuck.
    function resolveSpotlight(uint32 movement) external {
        Closing storage c = closings[movement];
        if (!c.seeded) revert SeedNotReady();
        if (c.resolved) revert AlreadyResolved();
        c.resolved = true;

        bytes32 seed = seeds[movement];
        uint256[MAX_SPOTLIGHTS] memory winners;
        uint256 count;
        for (uint256 i = 0; i < MAX_DRAWS && count < MAX_SPOTLIGHTS; i++) {
            uint256 tokenId = uint256(keccak256(abi.encode(seed, i))) % COLLECTION_SIZE + 1;
            if (!performedIn[movement][tokenId]) continue;
            bool duplicate;
            for (uint256 j = 0; j < count; j++) {
                if (winners[j] == tokenId) duplicate = true;
            }
            if (!duplicate) winners[count++] = tokenId;
        }

        uint256 pot = encorePot[movement];
        encorePot[movement] = 0;
        uint256 share = count == 0 ? 0 : pot / count;
        uint256 paidOut;

        for (uint256 j = 0; j < count; j++) {
            uint256 tokenId = winners[j];
            careers[tokenId].spotlights += 1;
            address owner = _ownerOrZero(tokenId);
            uint256 payout = owner == address(0) ? 0 : share;
            if (payout > 0) {
                paidOut += payout;
                chogToken.safeTransfer(owner, payout);
            }
            emit Spotlighted(movement, tokenId, owner, payout);
        }

        uint256 leftover = pot - paidOut;
        uint32 rolledInto = currentMovement();
        if (leftover > 0) encorePot[rolledInto] += leftover;
        emit SpotlightResolved(movement, count, paidOut, leftover, rolledInto);
    }

    /// @dev A Chog that can't report an owner (e.g. burned) forfeits its share to the
    /// rollover instead of blocking everyone else's payout.
    function _ownerOrZero(uint256 tokenId) private view returns (address) {
        try chogNft.ownerOf(tokenId) returns (address owner) {
            return owner;
        } catch {
            return address(0);
        }
    }
}
