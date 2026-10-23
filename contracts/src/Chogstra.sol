// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Chogstra: 1,969 Chogs, one live onchain song.
/// @notice Every Chog holder writes a 16-step loop for their Chog. All current
/// loops play together as one song. The song is split into 24h Movements.
/// @dev Monad executes transactions in parallel. `perform` only writes storage
/// keyed by its own tokenId (parts, careers), so performs for different Chogs in
/// the same block never conflict. Totals across Chogs come from the indexer.
contract Chogstra {
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
        uint32 spotlights; // set by the Spotlight draw (not built yet)
        uint64 applause;
    }

    struct Delegation {
        address to;
        uint64 expiry; // valid while block.timestamp < expiry
        address ownerAtGrant; // selling the Chog cancels the delegation
    }

    uint256 public constant MOVEMENT_LENGTH = 1 days;
    uint256 public constant OWNER_SHARE_BPS = 9_000; // 90% of a tip to the owner
    uint256 private constant BPS = 10_000;

    IERC721 public immutable chogNft;
    IERC20 public immutable chogToken;
    uint64 public immutable startTime;

    mapping(uint256 tokenId => Part) public parts;
    mapping(uint256 tokenId => Career) public careers;
    mapping(uint256 tokenId => Delegation) public delegations;
    mapping(uint256 movement => mapping(uint256 tokenId => mapping(address fan => bool))) public hasApplauded;
    /// @notice The 10% of tips kept per movement, for that movement's Spotlight Chogs.
    mapping(uint256 movement => uint256) public encorePot;

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

    error NotStarted();
    error NotOwnerOrDelegate();
    error NotOwner();
    error InvalidDelegation();
    error NoPartThisMovement();
    error AlreadyApplauded();
    error ZeroAmount();

    constructor(IERC721 chogNft_, IERC20 chogToken_, uint64 startTime_) {
        chogNft = chogNft_;
        chogToken = chogToken_;
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
    /// address per Chog per Movement.
    function applaud(uint256 tokenId) external {
        uint32 movement = currentMovement();
        Part storage part = parts[tokenId];
        if (part.updatedBlock == 0 || part.movement != movement) revert NoPartThisMovement();
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
    // TODO (build order step 5): Pyth Entropy + Spotlight
    // ---------------------------------------------------------------------
    // - closeMovement(): callable by anyone once a Movement's 24h are over.
    //   Requests a random number from Pyth Entropy (IEntropyV2) and pays its fee.
    // - entropyCallback(): sets the next Movement's key, tempo and theme, picks
    //   Spotlight Chogs from that Movement's performers (weighted by Tier,
    //   see web/lib/mapping.ts), bumps careers[tokenId].spotlights, and pays
    //   out encorePot[movement] to them.
    // Until this exists, $CHOG in encorePot stays in this contract with no way
    // out, so don't deploy this version anywhere tips can be real money.
}
