// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IHackathonRegistry.sol";

/**
 * @title LiquidityRail
 * @dev Bridge loans against confirmed hackathon wins, plus a payout market.
 *
 * Replaces BuilderCreditCore. No credit scores, no multipliers, no
 * admin-assigned reputation. See docs/VISION.md.
 *
 * ── Lifecycle ─────────────────────────────────────────────────────────────
 *
 *   anchorWin(hackathonId, declarationIndex)   — anyone; binds a rail win to a
 *     host-attested registry declaration. One rail win per declaration.
 *   proposeLoan(winId, terms)                  — a lender offers funded terms.
 *   commitTranche(proposalId)                  — the named first-loss provider
 *     escrows their capital. Optional, pre-accept, withdrawable.
 *   acceptLoan(proposalId)                     — the builder consents: posts
 *     collateral, receives principal net of fee.
 *   repayLoan(winId) / defaultLoan(winId)      — resolution.
 *
 * Builder consent is load-bearing: nobody can open a loan against someone
 * else's win, so nobody can vandalize a credibility record or pull a
 * builder's USDC into terms they never saw.
 *
 * ── Invariants, enforced structurally ─────────────────────────────────────
 *
 * 1. THE PLATFORM NEVER ABSORBS A CREDIT LOSS.
 *    Every loan requires collateral + committed tranche >= principal. On
 *    default the builder's collateral liquidates to the lender FIRST and the
 *    first-loss tranche covers any shortfall; surplus returns to its owner.
 *    No path pays a lender from the contract's own balance.
 *
 * 2. THE PLATFORM'S ONLY REVENUE IS FEES ON NOTIONAL.
 *    `accruedFees` is incremented atomically inside acceptLoan AND the fee is
 *    pulled into the contract in the same transaction — so withdrawFees can
 *    never reach principal, collateral, tranche capacity, or bet stakes.
 *
 * 3. LENDERS AND BETTORS ARE STRUCTURALLY SEPARATED.
 *    Lending principal and bet stakes are accounted separately. The market is
 *    parimutuel: winning stakes split the whole pool pro-rata, paid only from
 *    the bet pool. Neither pool can reach the other.
 *
 * 4. CREDIBILITY IS DERIVED, NEVER ASSIGNED.
 *    BuilderHistory is written only by anchor, accept, repay, default, and
 *    market resolution. There is no setter and no scoring role.
 *
 * 5. NO MULTIPLIER.
 *    Capital moves at par. A loan is repaid from the prize at face value.
 *
 * ── Storage ──────────────────────────────────────────────────────────────
 * WARNING: layout is fixed after first deploy. Append only; never reorder.
 */
contract LiquidityRail is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant FEE_ROLE = keccak256("FEE_ROLE");

    enum LoanMode {
        OVERCOLLATERALIZED, // collateral alone covers principal
        TRANCHE_BACKED,     // tranche alone covers principal
        HYBRID              // each below principal, together covering it
    }

    enum LoanStatus {
        NONE,
        OPEN,
        REPAID,
        DEFAULTED
    }

    enum ProposalStatus {
        NONE,
        OPEN,
        ACCEPTED,
        CANCELLED
    }

    enum MarketOutcome {
        UNRESOLVED,
        PAID,   // the organizer paid — recorded in the registry
        UNPAID  // resolution window elapsed with no recorded payout
    }

    struct BuilderHistory {
        uint256 winsAnchored;     // registry-attested wins claimed on the rail
        uint256 winsPaid;         // resolved: the organizer actually paid
        uint256 winsUnpaid;       // resolved: deadline passed with no payout
        uint256 loansTaken;
        uint256 loansRepaid;
        uint256 loansDefaulted;
        uint256 totalDaysToPay;   // sum of (paidAt - declaredAt) over winsPaid
        uint256 fastestDaysToPay;
    }

    struct Win {
        uint256 hackathonId;
        uint256 declarationIndex; // index into registry.winnerDeclarations
        address builder;
        uint256 prizeAmount;
        uint256 declaredAt;       // the registry's declaredAt — the real anchor
        uint256 resolutionDeadline; // declaredAt + window, frozen at anchor so setResolutionWindow can't rewrite live markets
    }

    struct Proposal {
        uint256 winId;
        address lender;
        uint256 principal;
        uint256 collateral;        // required from the builder at accept
        uint256 trancheSize;       // committed by trancheProvider
        address trancheProvider;
        bool trancheCommitted;
        uint256 feeBps;            // flat origination fee on notional, in bps
        uint256 durationDays;
        uint256 incentives;        // bitfield of builder-committed incentives
        ProposalStatus status;
    }

    struct Loan {
        uint256 winId;
        uint256 proposalId;
        address lender;
        address builder;
        address trancheProvider;
        uint256 principal;
        uint256 collateral;
        uint256 trancheSize;
        uint256 originationFee;
        uint256 dueAt;
        LoanMode mode;
        LoanStatus status;
        uint256 incentives;
    }

    /// @dev Parimutuel payout market on one win: winning side splits the pool.
    struct Market {
        uint256 paidPool;          // stake on "the organizer pays"
        uint256 unpaidPool;        // stake on "the organizer doesn't pay"
        MarketOutcome outcome;
        uint256 resolvedAt;
    }

    uint256 public winCount;
    uint256 public proposalCount;

    IHackathonRegistry public registry;
    IERC20 public usdcToken;
    address public feeRecipient;

    mapping(uint256 => Win) public wins;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => Loan) public loans;           // keyed by winId — one loan per win
    mapping(uint256 => Market) public markets;       // keyed by winId
    // hackathonId => declarationIndex => winId (0 = not anchored)
    mapping(uint256 => mapping(uint256 => uint256)) public declarationWin;
    // winId => bettor => stake, one mapping per side
    mapping(uint256 => mapping(address => uint256)) public paidStakes;
    mapping(uint256 => mapping(address => uint256)) public unpaidStakes;
    mapping(address => BuilderHistory) public builderHistory;
    mapping(address => uint256[]) private _builderWins;

    /// @notice Outstanding loan principal. Never withdrawable.
    uint256 public totalLoanPrincipal;
    /// @notice Builder-posted collateral in escrow. Never withdrawable.
    uint256 public totalCollateral;
    /// @notice First-loss capacity currently escrowed. Never withdrawable.
    uint256 public totalTrancheCapacity;
    /// @notice Tranche capital consumed by defaults so far.
    uint256 public totalTrancheAbsorbed;
    /// @notice All bet stakes ever placed.
    uint256 public totalBetStakes;
    /// @notice Stakes sitting in markets that have not resolved yet.
    uint256 public outstandingBetStakes;
    /// @notice Unclaimed payouts owed to winning bettors.
    uint256 public totalBetOwed;

    /// @notice The ONLY balance FEE_ROLE may withdraw — and it is actually
    /// funded: the fee is pulled into the contract at acceptLoan, not just
    /// accounted. A withdrawal can therefore never touch escrowed capital.
    uint256 public accruedFees;

    uint256 public maxLoanSize;
    uint256 public maxFeeBps;
    uint256 public maxLoanDuration;
    /// @notice Seconds after declaredAt at which a market may resolve UNPAID.
    /// Default 90 days — the rail exists because prizes shouldn't take that long.
    uint256 public marketResolutionWindow;

    event WinAnchored(
        uint256 indexed winId,
        uint256 indexed hackathonId,
        uint256 declarationIndex,
        address indexed builder,
        string projectName,
        uint256 prizeAmount,
        uint256 declaredAt
    );
    event LoanProposed(
        uint256 indexed proposalId,
        uint256 indexed winId,
        address indexed lender,
        uint256 principal,
        uint256 collateral,
        uint256 trancheSize,
        address trancheProvider,
        uint256 feeBps,
        uint256 durationDays,
        uint256 incentives
    );
    event TrancheCommitted(uint256 indexed proposalId, address indexed provider, uint256 amount);
    event TrancheWithdrawn(uint256 indexed proposalId, address indexed provider, uint256 amount);
    event ProposalCancelled(uint256 indexed proposalId, uint256 indexed winId);
    event LoanFunded(
        uint256 indexed proposalId,
        uint256 indexed winId,
        address indexed lender,
        address builder,
        uint256 principal,
        uint256 originationFee,
        uint256 collateral,
        uint256 trancheSize,
        uint256 dueAt,
        uint8 mode
    );
    event LoanRepaid(uint256 indexed winId, address indexed lender, address indexed builder, uint256 principal);
    event LoanDefaulted(
        uint256 indexed winId,
        address indexed builder,
        uint256 principal,
        uint256 collateralToLender,
        uint256 trancheToLender
    );
    event CollateralReleased(uint256 indexed winId, address indexed builder, uint256 amount);
    event TrancheReleased(uint256 indexed winId, address indexed provider, uint256 amount);
    event BetPlaced(uint256 indexed winId, address indexed bettor, uint256 amount, bool expectsPayment);
    event MarketResolved(uint256 indexed winId, uint8 outcome, uint256 paidPool, uint256 unpaidPool);
    event WinningsClaimed(uint256 indexed winId, address indexed bettor, uint256 stake, uint256 payout);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event BoundsUpdated(uint256 maxLoanSize, uint256 maxFeeBps, uint256 maxLoanDuration);
    event ResolutionWindowUpdated(uint256 windowSeconds);
    event FeeRecipientUpdated(address indexed previous, address indexed next);
    event RegistryUpdated(address indexed registry);
    event UsdcTokenUpdated(address indexed token);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _registry,
        address _usdcToken,
        address _admin,
        address _feeRecipient
    ) external initializer {
        require(_registry != address(0), "Invalid registry");
        require(_usdcToken != address(0), "Invalid token");
        require(_admin != address(0), "Invalid admin");
        require(_feeRecipient != address(0), "Invalid fee recipient");

        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        registry = IHackathonRegistry(_registry);
        usdcToken = IERC20(_usdcToken);
        feeRecipient = _feeRecipient;

        maxLoanSize = 50_000 * 1e6;
        maxFeeBps = 2000;
        maxLoanDuration = 180 days;
        marketResolutionWindow = 90 days;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(FEE_ROLE, _feeRecipient);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ── Wins ──────────────────────────────────────────────────────────────

    /**
     * @notice Anchors a registry-attested win on the rail. Permissionless:
     * the builder address and prize come FROM the host's declaration, so a
     * win cannot be invented or inflated here — anchoring just indexes truth
     * the hackathon host already attested.
     *
     * One rail win per registry declaration, so the same prize can never be
     * borrowed against twice.
     */
    function anchorWin(uint256 hackathonId, uint256 declarationIndex)
        external
        whenNotPaused
        returns (uint256 winId)
    {
        require(registry.hackathonExists(hackathonId), "Unknown hackathon");
        require(
            declarationWin[hackathonId][declarationIndex] == 0,
            "Win already anchored"
        );

        // Reverts out of range; a declaration is host-attested truth.
        IHackathonRegistry.WinnerDeclaration memory decl =
            registry.getDeclaration(hackathonId, declarationIndex);

        winCount += 1;
        winId = winCount;
        declarationWin[hackathonId][declarationIndex] = winId;

        wins[winId] = Win({
            hackathonId: hackathonId,
            declarationIndex: declarationIndex,
            builder: decl.winner,
            prizeAmount: decl.prizeAmount,
            declaredAt: decl.declaredAt,
            resolutionDeadline: decl.declaredAt + marketResolutionWindow
        });
        _builderWins[decl.winner].push(winId);

        builderHistory[decl.winner].winsAnchored += 1;

        emit WinAnchored(
            winId,
            hackathonId,
            declarationIndex,
            decl.winner,
            decl.projectName,
            decl.prizeAmount,
            decl.declaredAt
        );
    }

    // ── Loan lifecycle ────────────────────────────────────────────────────

    /**
     * @notice A lender offers funded terms against an anchored win. Nothing
     * moves yet — capital flows atomically at acceptLoan, once the builder
     * has consented to these exact terms.
     *
     * Coverage is required up front: collateral (posted by the builder at
     * accept) plus trancheSize (escrowed by a third-party provider via
     * commitTranche) must reach principal. Any mix is allowed — that is what
     * keeps "the platform never absorbs a credit loss" structural.
     */
    function proposeLoan(
        uint256 winId,
        uint256 principal,
        uint256 collateral,
        uint256 trancheSize,
        address trancheProvider,
        uint256 feeBps,
        uint256 durationDays,
        uint256 incentives
    ) external whenNotPaused returns (uint256 proposalId) {
        Win storage win = wins[winId];
        require(win.builder != address(0), "Unknown win");
        require(msg.sender != win.builder, "Builder cannot self-fund");
        require(
            loans[winId].status == LoanStatus.NONE,
            "Win already financed"
        );
        (bool paid, ) = _payoutState(win);
        require(!paid, "Prize already paid");

        require(principal > 0, "Principal must be > 0");
        require(principal <= maxLoanSize, "Loan exceeds max size");
        require(principal <= win.prizeAmount, "Principal exceeds prize");
        require(feeBps <= maxFeeBps, "Fee exceeds ceiling");
        require(
            durationDays > 0 && durationDays * 1 days <= maxLoanDuration,
            "Bad duration"
        );
        require(
            collateral + trancheSize >= principal,
            "Coverage below principal"
        );
        if (trancheSize > 0) {
            require(trancheProvider != address(0), "Tranche provider required");
            require(trancheProvider != msg.sender, "Tranche must be third-party");
            require(
                trancheProvider != win.builder,
                "Builder cannot back own loan"
            );
        } else {
            trancheProvider = address(0);
        }

        proposalCount += 1;
        proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            winId: winId,
            lender: msg.sender,
            principal: principal,
            collateral: collateral,
            trancheSize: trancheSize,
            trancheProvider: trancheProvider,
            trancheCommitted: false,
            feeBps: feeBps,
            durationDays: durationDays,
            incentives: incentives,
            status: ProposalStatus.OPEN
        });

        emit LoanProposed(
            proposalId,
            winId,
            msg.sender,
            principal,
            collateral,
            trancheSize,
            trancheProvider,
            feeBps,
            durationDays,
            incentives
        );
    }

    /**
     * @notice The named provider escrows first-loss capital for a proposal.
     * Explicit commitment — never implied by a bare ERC-20 approval — so a
     * provider's balance can't be pulled into terms they never saw.
     */
    function commitTranche(uint256 proposalId)
        external
        whenNotPaused
        nonReentrant
    {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.OPEN, "Proposal not open");
        require(p.trancheSize > 0, "No tranche on proposal");
        require(msg.sender == p.trancheProvider, "Not tranche provider");
        require(!p.trancheCommitted, "Tranche already committed");

        p.trancheCommitted = true;
        totalTrancheCapacity += p.trancheSize;

        usdcToken.safeTransferFrom(msg.sender, address(this), p.trancheSize);

        emit TrancheCommitted(proposalId, msg.sender, p.trancheSize);
    }

    /**
     * @notice Provider reclaims an unaccepted commitment. An exit, not new
     * risk — stays callable while paused.
     */
    function withdrawTranche(uint256 proposalId) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.OPEN, "Proposal not open");
        require(msg.sender == p.trancheProvider, "Not tranche provider");
        require(p.trancheCommitted, "Tranche not committed");

        p.trancheCommitted = false;
        totalTrancheCapacity -= p.trancheSize;

        usdcToken.safeTransfer(msg.sender, p.trancheSize);

        emit TrancheWithdrawn(proposalId, msg.sender, p.trancheSize);
    }

    /**
     * @notice Lender withdraws an unaccepted offer; any committed tranche is
     * refunded to its provider. An exit, not new risk.
     */
    function cancelProposal(uint256 proposalId) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.OPEN, "Proposal not open");
        require(msg.sender == p.lender, "Not lender");

        p.status = ProposalStatus.CANCELLED;

        if (p.trancheCommitted) {
            p.trancheCommitted = false;
            totalTrancheCapacity -= p.trancheSize;
            usdcToken.safeTransfer(p.trancheProvider, p.trancheSize);
            emit TrancheWithdrawn(proposalId, p.trancheProvider, p.trancheSize);
        }

        emit ProposalCancelled(proposalId, p.winId);
    }

    /**
     * @notice The builder accepts funded terms. This is the consent moment:
     * the builder posts their own collateral, the fee is segregated into the
     * contract, and principal flows straight lender → builder (net of fee).
     * The contract never custodies principal.
     */
    function acceptLoan(uint256 proposalId)
        external
        whenNotPaused
        nonReentrant
    {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.OPEN, "Proposal not open");
        Win storage win = wins[p.winId];
        require(msg.sender == win.builder, "Not the builder");
        require(
            loans[p.winId].status == LoanStatus.NONE,
            "Win already financed"
        );
        (bool paid, ) = _payoutState(win);
        require(!paid, "Prize already paid");
        if (p.trancheSize > 0) {
            require(p.trancheCommitted, "Tranche not committed");
        }

        p.status = ProposalStatus.ACCEPTED;

        uint256 originationFee = (p.principal * p.feeBps) / 10_000;
        LoanMode mode = p.collateral >= p.principal
            ? LoanMode.OVERCOLLATERALIZED
            : (p.trancheSize >= p.principal && p.collateral == 0
                ? LoanMode.TRANCHE_BACKED
                : LoanMode.HYBRID);

        loans[p.winId] = Loan({
            winId: p.winId,
            proposalId: proposalId,
            lender: p.lender,
            builder: msg.sender,
            trancheProvider: p.trancheProvider,
            principal: p.principal,
            collateral: p.collateral,
            trancheSize: p.trancheSize,
            originationFee: originationFee,
            dueAt: block.timestamp + (p.durationDays * 1 days),
            mode: mode,
            status: LoanStatus.OPEN,
            incentives: p.incentives
        });

        totalLoanPrincipal += p.principal;
        totalCollateral += p.collateral;
        accruedFees += originationFee;

        // Builder posts collateral — accepting the loan IS the consent.
        if (p.collateral > 0) {
            usdcToken.safeTransferFrom(msg.sender, address(this), p.collateral);
        }
        // The fee enters the contract so accruedFees is backed by real balance.
        if (originationFee > 0) {
            usdcToken.safeTransferFrom(p.lender, address(this), originationFee);
        }
        // Principal flows straight through, net of the fee.
        uint256 netToBuilder = p.principal - originationFee;
        if (netToBuilder > 0) {
            usdcToken.safeTransferFrom(p.lender, msg.sender, netToBuilder);
        }

        builderHistory[msg.sender].loansTaken += 1;

        emit LoanFunded(
            proposalId,
            p.winId,
            p.lender,
            msg.sender,
            p.principal,
            originationFee,
            p.collateral,
            p.trancheSize,
            loans[p.winId].dueAt,
            uint8(mode)
        );
    }

    /**
     * @notice Repays an open loan at par. Anyone may pay — typically the
     * builder once the prize lands. Collateral returns to the builder and the
     * tranche releases to its provider in the same transaction.
     *
     * Repayment is pulled FROM the payer, not paid out by the contract — the
     * platform can never be made to pay principal. An exit: unpausable.
     */
    function repayLoan(uint256 winId) external nonReentrant {
        Loan storage loan = loans[winId];
        require(loan.status == LoanStatus.OPEN, "Loan not open");

        loan.status = LoanStatus.REPAID;
        totalLoanPrincipal -= loan.principal;

        usdcToken.safeTransferFrom(msg.sender, loan.lender, loan.principal);

        if (loan.collateral > 0) {
            totalCollateral -= loan.collateral;
            usdcToken.safeTransfer(loan.builder, loan.collateral);
            emit CollateralReleased(winId, loan.builder, loan.collateral);
        }
        if (loan.trancheSize > 0) {
            totalTrancheCapacity -= loan.trancheSize;
            usdcToken.safeTransfer(loan.trancheProvider, loan.trancheSize);
            emit TrancheReleased(winId, loan.trancheProvider, loan.trancheSize);
        }

        builderHistory[loan.builder].loansRepaid += 1;

        emit LoanRepaid(winId, loan.lender, loan.builder, loan.principal);
    }

    /**
     * @notice Marks an over-due loan as defaulted. Permissionless after dueAt.
     *
     * The builder's collateral liquidates to the lender first; the first-loss
     * tranche covers any shortfall; surplus returns to its owner. In no case
     * does the contract pay the lender. An exit: unpausable.
     *
     * A recorded payout closes this path. Without the check, any passer-by
     * could liquidate a builder between the organizer paying and the builder
     * repaying, because dueAt alone says nothing about the prize landing.
     */
    function defaultLoan(uint256 winId) external nonReentrant {
        Loan storage loan = loans[winId];
        require(loan.status == LoanStatus.OPEN, "Loan not open");
        require(block.timestamp >= loan.dueAt, "Not yet due");

        (bool paid, ) = _payoutState(wins[winId]);
        require(!paid, "Payout already recorded");

        loan.status = LoanStatus.DEFAULTED;
        totalLoanPrincipal -= loan.principal;

        uint256 remaining = loan.principal;
        uint256 collateralToLender = 0;
        uint256 trancheToLender = 0;

        if (loan.collateral > 0) {
            totalCollateral -= loan.collateral;
            collateralToLender = loan.collateral < remaining
                ? loan.collateral
                : remaining;
            remaining -= collateralToLender;
            if (collateralToLender > 0) {
                usdcToken.safeTransfer(loan.lender, collateralToLender);
            }
            uint256 collateralSurplus = loan.collateral - collateralToLender;
            if (collateralSurplus > 0) {
                usdcToken.safeTransfer(loan.builder, collateralSurplus);
            }
        }

        if (loan.trancheSize > 0) {
            totalTrancheCapacity -= loan.trancheSize;
            if (remaining > 0) {
                trancheToLender = loan.trancheSize < remaining
                    ? loan.trancheSize
                    : remaining;
                remaining -= trancheToLender;
                totalTrancheAbsorbed += trancheToLender;
                usdcToken.safeTransfer(loan.lender, trancheToLender);
            }
            uint256 trancheRefund = loan.trancheSize - trancheToLender;
            if (trancheRefund > 0) {
                usdcToken.safeTransfer(loan.trancheProvider, trancheRefund);
            }
        }

        builderHistory[loan.builder].loansDefaulted += 1;

        emit LoanDefaulted(
            winId,
            loan.builder,
            loan.principal,
            collateralToLender,
            trancheToLender
        );
    }

    /**
     * @dev (paid, paidAt) for the registry declaration this win is bound to.
     * Fails closed: if the registry cannot answer, the payout is treated as
     * unrecorded rather than assumed.
     */
    function _payoutState(Win storage win)
        private
        view
        returns (bool paid, uint256 paidAt)
    {
        try registry.getDeclaration(win.hackathonId, win.declarationIndex)
            returns (IHackathonRegistry.WinnerDeclaration memory decl)
        {
            return (decl.paidAt > 0, decl.paidAt);
        } catch {
            return (false, 0);
        }
    }

    // ── Market ────────────────────────────────────────────────────────────

    /**
     * @notice Stakes on whether the organizer will actually pay the prize.
     * Parimutuel: winning stakes split the entire pool pro-rata. The pool is
     * funded only by bettors and paid only to bettors.
     *
     * A bettor may hold positions on both sides — hedging costs more than it
     * can return, so it needs no guard.
     */
    function placeBet(uint256 winId, uint256 amount, bool expectsPayment)
        external
        whenNotPaused
        nonReentrant
    {
        require(amount > 0, "Amount must be > 0");
        Win storage win = wins[winId];
        require(win.builder != address(0), "Unknown win");
        require(msg.sender != win.builder, "Builder cannot bet on own win");

        Market storage m = markets[winId];
        require(m.outcome == MarketOutcome.UNRESOLVED, "Market resolved");
        (bool paid, ) = _payoutState(win);
        require(!paid, "Payout already recorded");
        require(block.timestamp < win.resolutionDeadline, "Market closed");

        if (expectsPayment) {
            m.paidPool += amount;
            paidStakes[winId][msg.sender] += amount;
        } else {
            m.unpaidPool += amount;
            unpaidStakes[winId][msg.sender] += amount;
        }
        totalBetStakes += amount;
        outstandingBetStakes += amount;

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        emit BetPlaced(winId, msg.sender, amount, expectsPayment);
    }

    /**
     * @notice Resolves a market on the fact it actually measures: whether the
     * organizer paid, per the registry — NOT the builder's loan outcome. A
     * win with no loan resolves exactly the same way.
     *
     * PAID once the registry records a payout; UNPAID once the resolution
     * window (default 90 days from declaredAt) elapses without one.
     * Permissionless: the outcome is whatever the record says.
     */
    function resolveMarket(uint256 winId) external nonReentrant {
        Win storage win = wins[winId];
        require(win.builder != address(0), "Unknown win");
        Market storage m = markets[winId];
        require(m.outcome == MarketOutcome.UNRESOLVED, "Market resolved");

        (bool paid, uint256 paidAt) = _payoutState(win);
        MarketOutcome outcome;
        if (paid) {
            outcome = MarketOutcome.PAID;
        } else {
            require(
                block.timestamp >= win.resolutionDeadline,
                "Win unresolved"
            );
            outcome = MarketOutcome.UNPAID;
        }

        m.outcome = outcome;
        m.resolvedAt = block.timestamp;
        totalBetOwed += m.paidPool + m.unpaidPool;
        outstandingBetStakes -= m.paidPool + m.unpaidPool;

        // Resolution is where the registry's paidAt first becomes knowable,
        // so builder history learns the timing stats here — derived, as ever.
        BuilderHistory storage history = builderHistory[win.builder];
        if (outcome == MarketOutcome.PAID) {
            history.winsPaid += 1;
            uint256 daysToPay = (paidAt - win.declaredAt) / 1 days;
            history.totalDaysToPay += daysToPay;
            if (
                history.fastestDaysToPay == 0 ||
                daysToPay < history.fastestDaysToPay
            ) {
                history.fastestDaysToPay = daysToPay;
            }
        } else {
            history.winsUnpaid += 1;
        }

        emit MarketResolved(winId, uint8(outcome), m.paidPool, m.unpaidPool);
    }

    /**
     * @notice Claims a resolved market. Winners receive their pro-rata share
     * of the whole pool; losing stakes are swept to winners. O(1) per claim.
     * An exit: unpausable.
     */
    function claimWinnings(uint256 winId) external nonReentrant {
        Market storage m = markets[winId];
        require(m.outcome != MarketOutcome.UNRESOLVED, "Market unresolved");

        bool paidSide = m.outcome == MarketOutcome.PAID;
        uint256 stake = paidSide
            ? paidStakes[winId][msg.sender]
            : unpaidStakes[winId][msg.sender];
        require(stake > 0, "Nothing to claim");

        if (paidSide) {
            paidStakes[winId][msg.sender] = 0;
        } else {
            unpaidStakes[winId][msg.sender] = 0;
        }

        uint256 winningPool = paidSide ? m.paidPool : m.unpaidPool;
        uint256 payout = (stake * (m.paidPool + m.unpaidPool)) / winningPool;
        totalBetOwed -= payout;

        usdcToken.safeTransfer(msg.sender, payout);

        emit WinningsClaimed(winId, msg.sender, stake, payout);
    }

    // ── Fees & admin ──────────────────────────────────────────────────────

    /**
     * @notice Withdraws accrued fees. The only function that moves USDC out on
     * an admin's behalf, and it can only ever reach `accruedFees` — a balance
     * that is actually funded, since the fee entered the contract at accept.
     * An exit: unpausable.
     */
    function withdrawFees(address to, uint256 amount)
        external
        onlyRole(FEE_ROLE)
        nonReentrant
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(amount <= accruedFees, "Insufficient accrued fees");

        accruedFees -= amount;
        usdcToken.safeTransfer(to, amount);

        emit FeesWithdrawn(to, amount);
    }

    function setBounds(uint256 _maxLoanSize, uint256 _maxFeeBps, uint256 _maxLoanDuration)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        maxLoanSize = _maxLoanSize;
        maxFeeBps = _maxFeeBps;
        maxLoanDuration = _maxLoanDuration;
        emit BoundsUpdated(_maxLoanSize, _maxFeeBps, _maxLoanDuration);
    }

    function setResolutionWindow(uint256 windowSeconds)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(windowSeconds > 0, "Window must be > 0");
        marketResolutionWindow = windowSeconds;
        emit ResolutionWindowUpdated(windowSeconds);
    }

    function updateFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRecipient != address(0), "Invalid recipient");
        address previous = feeRecipient;
        _revokeRole(FEE_ROLE, previous);
        feeRecipient = newRecipient;
        _grantRole(FEE_ROLE, newRecipient);
        emit FeeRecipientUpdated(previous, newRecipient);
    }

    /// @dev Pause stops new risk only — anchoring, proposing, committing,
    /// accepting, betting. Exits (repay, default, cancel, withdraw, resolve,
    /// claim, fees) stay open: an emergency must never trap funds already owed.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Swapping the registry rebinds every anchored win's declarationIndex
     * onto a different array — payout state for live markets would resolve
     * against foreign data, and _payoutState fails closed, so open loans and
     * staked markets would resolve UNPAID. totalBetOwed is exempt: those are
     * resolved claims already priced into the market record, paid out of the
     * balance without consulting the registry — and its losing-side dust is
     * unclaimable, so counting it would freeze swaps forever.
     */
    function updateRegistry(address _registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_registry != address(0), "Invalid registry");
        require(
            totalLoanPrincipal == 0 &&
                totalCollateral == 0 &&
                totalTrancheCapacity == 0 &&
                outstandingBetStakes == 0,
            "Unresolved markets"
        );
        registry = IHackathonRegistry(_registry);
        emit RegistryUpdated(_registry);
    }

    /**
     * @dev The token denominates every escrow — swapping it with obligations
     * live would strand or mismatch them. Only allowed on a clean book.
     */
    function updateUsdcToken(address _usdcToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_usdcToken != address(0), "Invalid token");
        require(
            totalLoanPrincipal == 0 &&
                totalCollateral == 0 &&
                totalTrancheCapacity == 0 &&
                outstandingBetStakes == 0 &&
                totalBetOwed == 0 &&
                accruedFees == 0,
            "Live obligations"
        );
        usdcToken = IERC20(_usdcToken);
        emit UsdcTokenUpdated(_usdcToken);
    }

    // ── Credibility views ─────────────────────────────────────────────────

    /// @notice Win ids a builder has anchored, in anchor order.
    function builderWins(address builder) external view returns (uint256[] memory) {
        return _builderWins[builder];
    }

    /// @notice Share of a builder's anchored wins the organizer actually paid,
    /// per 10,000 resolved wins. Measures the payout record, not the loans.
    function payoutRateBps(address builder) external view returns (uint256) {
        BuilderHistory storage history = builderHistory[builder];
        uint256 resolved = history.winsPaid + history.winsUnpaid;
        if (resolved == 0) return 0;
        return (history.winsPaid * 10_000) / resolved;
    }

    /// @notice Share of a builder's loans repaid, per 10,000 resolved loans.
    function repaymentRateBps(address builder) external view returns (uint256) {
        BuilderHistory storage history = builderHistory[builder];
        uint256 resolved = history.loansRepaid + history.loansDefaulted;
        if (resolved == 0) return 0;
        return (history.loansRepaid * 10_000) / resolved;
    }

    /// @notice Mean days from declared win to recorded payout.
    function averageDaysToPay(address builder) external view returns (uint256) {
        BuilderHistory storage history = builderHistory[builder];
        if (history.winsPaid == 0) return 0;
        return history.totalDaysToPay / history.winsPaid;
    }

    /**
     * @dev Reserve for future storage — upgradeable contracts must leave
     * room to append variables without colliding with a later base contract.
     */
    uint256[48] private __gap;
}
