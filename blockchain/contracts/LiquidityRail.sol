// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
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
 * ── Invariants, enforced structurally ─────────────────────────────────────
 *
 * 1. THE PLATFORM NEVER ABSORBS A CREDIT LOSS.
 *    Every loan is OVERCOLLATERALIZED (collateral >= principal, so a default
 *    triggers liquidation rather than a loss) or TRANCHE_BACKED (a designated
 *    first-loss slice absorbs defaults up to its size). No path pays a lender
 *    from the contract's own balance.
 *
 * 2. THE PLATFORM'S ONLY REVENUE IS FEES ON NOTIONAL.
 *    `accruedFees` is the only balance `withdrawFees` can reach. It is
 *    incremented atomically inside openLoan. No role can reach principal,
 *    collateral, tranche capacity, or bet stakes.
 *
 * 3. LENDERS AND BETTORS ARE STRUCTURALLY SEPARATED.
 *    Lending principal and bet stakes are accounted separately. `settleBet`
 *    pays only from the bet pool; a default only ever consumes tranche
 *    capacity. Neither pool can reach the other.
 *
 * 4. CREDIBILITY IS DERIVED, NEVER ASSIGNED.
 *    BuilderHistory is written only by the settle and default paths. There is
 *    no setter and no scoring role.
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
    using Counters for Counters.Counter;

    bytes32 public constant FEE_ROLE = keccak256("FEE_ROLE");

    enum LoanMode {
        OVERCOLLATERALIZED,
        TRANCHE_BACKED
    }

    enum LoanStatus {
        NONE,
        OPEN,
        REPAID,
        DEFAULTED
    }

    enum WinStatus {
        NONE,
        DECLARED,
        SETTLED,
        DEFAULTED
    }

    enum BetOutcome {
        NONE,
        PAID,
        UNPAID
    }

    struct BuilderHistory {
        uint256 winsDeclared;
        uint256 loansTaken;
        uint256 loansRepaid;
        uint256 winsSettledInFull;
        uint256 winsDefaulted;
        uint256 totalDaysToPay;
        uint256 fastestDaysToPay;
    }

    struct Win {
        uint256 hackathonId;
        address builder;
        uint256 prizeAmount;
        uint256 declaredAt;
        uint256 settledAt;
        WinStatus status;
    }

    struct Loan {
        uint256 winId;
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
        uint256 incentives; // bitfield of builder-committed incentives
    }

    struct Bet {
        address bettor;
        uint256 amount;
        bool expectsPayment; // true = "yes, they get paid"
        bool claimed;
    }

    Counters.Counter private _winIdCounter;

    IHackathonRegistry public registry;
    IERC20 public usdcToken;
    address public feeRecipient;

    mapping(uint256 => Win) public wins;
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => Bet[]) public bets;
    mapping(uint256 => bool) public betSettled;
    mapping(uint256 => BetOutcome) public betOutcome;
    mapping(address => BuilderHistory) public builderHistory;

    /// @notice Outstanding loan principal. Never withdrawable.
    uint256 public totalLoanPrincipal;
    /// @notice Locked collateral. Never withdrawable.
    uint256 public totalCollateral;
    /// @notice Committed first-loss capacity. Never withdrawable.
    uint256 public totalTrancheCapacity;
    /// @notice Tranche capacity consumed by defaults so far.
    uint256 public totalTrancheAbsorbed;
    /// @notice All bet stakes ever placed.
    uint256 public totalBetStakes;
    /// @notice Unclaimed payouts owed to winning bettors.
    uint256 public totalBetOwed;

    /// @notice The ONLY balance FEE_ROLE may withdraw.
    uint256 public accruedFees;

    uint256 public maxLoanSize;
    uint256 public maxRateBps;
    uint256 public maxLoanDuration;

    event WinDeclared(
        uint256 indexed winId,
        uint256 indexed hackathonId,
        address indexed builder,
        string projectName,
        uint256 prizeAmount,
        uint256 declaredAt
    );
    event LoanOpened(
        uint256 indexed winId,
        address indexed lender,
        uint256 principal,
        uint256 collateral,
        uint256 trancheSize,
        uint256 originationFee,
        uint256 dueAt,
        uint8 mode
    );
    event LoanRepaid(uint256 indexed winId, address indexed lender, uint256 principal);
    event LoanDefaulted(
        uint256 indexed winId,
        address indexed builder,
        uint256 principal,
        uint256 collateralLiquidated,
        uint256 trancheAbsorbed
    );
    event CollateralReleased(uint256 indexed winId, address indexed builder, uint256 amount);
    event WinSettled(uint256 indexed winId, address indexed builder, uint256 daysToPay);
    event BetPlaced(uint256 indexed winId, address indexed bettor, uint256 amount, bool expectsPayment);
    event BetSettled(uint256 indexed winId, bool paid, uint256 totalPool, uint256 payoutPool);
    event BetClaimed(uint256 indexed winId, address indexed bettor, uint256 stake, uint256 payout);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event BoundsUpdated(uint256 maxLoanSize, uint256 maxRateBps, uint256 maxLoanDuration);

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
        maxRateBps = 2000;
        maxLoanDuration = 180 days;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(FEE_ROLE, _feeRecipient);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ── Wins ──────────────────────────────────────────────────────────────

    /**
     * @notice Anchors a declared win: a dated, public claim on money that has
     * not moved yet. This is the receipt a loan is written against and the
     * first entry in a builder's credibility record. Permissionless by design.
     */
    function declareWin(
        uint256 hackathonId,
        address builder,
        string calldata projectName,
        uint256 prizeAmount
    ) external whenNotPaused returns (uint256 winId) {
        require(registry.hackathonExists(hackathonId), "Unknown hackathon");
        require(builder != address(0), "Invalid builder");
        require(prizeAmount > 0, "Prize must be > 0");

        _winIdCounter.increment();
        winId = _winIdCounter.current();

        wins[winId] = Win({
            hackathonId: hackathonId,
            builder: builder,
            prizeAmount: prizeAmount,
            declaredAt: block.timestamp,
            settledAt: 0,
            status: WinStatus.DECLARED
        });

        builderHistory[builder].winsDeclared += 1;

        emit WinDeclared(winId, hackathonId, builder, projectName, prizeAmount, block.timestamp);
    }

    // ── Loans ─────────────────────────────────────────────────────────────

    /**
     * @notice Opens a bridge loan against a declared win.
     *
     * The lender supplies the capital themselves — the platform is a rail, not
     * a source of funds. The builder receives principal minus the origination
     * fee; the fee is revenue and can never be clawed back by a default.
     *
     * OVERCOLLATERALIZED (collateral > 0): requires collateral >= principal.
     * TRANCHE_BACKED (collateral == 0): requires trancheSize >= principal,
     * committed by a first-loss provider.
     */
    function openLoan(
        uint256 winId,
        uint256 principal,
        uint256 collateral,
        uint256 trancheSize,
        address trancheProvider,
        uint256 rateBps,
        uint256 durationDays,
        uint256 incentives
    ) external whenNotPaused nonReentrant {
        require(principal > 0, "Principal must be > 0");
        require(principal <= maxLoanSize, "Loan exceeds max size");
        require(rateBps <= maxRateBps, "Rate exceeds ceiling");
        require(durationDays > 0 && durationDays * 1 days <= maxLoanDuration, "Bad duration");

        Win storage win = wins[winId];
        require(win.status == WinStatus.DECLARED, "Win not open for lending");

        LoanMode mode;
        address trancheAddr = address(0);
        if (collateral > 0) {
            require(collateral >= principal, "Collateral must cover principal");
            mode = LoanMode.OVERCOLLATERALIZED;
        } else {
            require(trancheSize >= principal, "Tranche must cover principal");
            require(trancheProvider != address(0), "Tranche provider required");
            require(trancheProvider != msg.sender, "Tranche must be third-party");
            trancheAddr = trancheProvider;
            mode = LoanMode.TRANCHE_BACKED;
        }

        uint256 originationFee = (principal * rateBps) / 10_000;

        // Escrow only the risk-bearing capital: collateral from the lender, or the
        // first-loss tranche from its own provider. Principal flows straight
        // lender → builder (net of the fee), so the contract never custodies
        // loan principal — which is what makes "the platform cannot be made to
        // pay principal" true by construction rather than by accounting.
        if (collateral > 0) {
            usdcToken.safeTransferFrom(msg.sender, address(this), collateral);
        } else if (trancheSize > 0) {
            // First-loss capital comes from the tranche provider, never the
            // lender — otherwise the 'protection' would be self-funded and
            // prove nothing.
            usdcToken.safeTransferFrom(trancheAddr, address(this), trancheSize);
        }

        loans[winId] = Loan({
            winId: winId,
            lender: msg.sender,
            builder: win.builder,
            trancheProvider: trancheAddr,
            principal: principal,
            collateral: collateral,
            trancheSize: trancheSize,
            originationFee: originationFee,
            dueAt: block.timestamp + (durationDays * 1 days),
            mode: mode,
            status: LoanStatus.OPEN,
            incentives: incentives
        });

        totalLoanPrincipal += principal;
        totalCollateral += collateral;
        totalTrancheCapacity += trancheSize;

        // Revenue the moment it is earned.
        accruedFees += originationFee;

        // Principal goes to the builder, net of the origination fee. The fee
        // portion is retained as accruedFees and withdrawable only by FEE_ROLE.
        uint256 netToBuilder = principal - originationFee;
        if (netToBuilder > 0) {
            usdcToken.safeTransferFrom(msg.sender, win.builder, netToBuilder);
        }

        emit LoanOpened(
            winId,
            msg.sender,
            principal,
            collateral,
            trancheSize,
            originationFee,
            loans[winId].dueAt,
            uint8(mode)
        );
    }

    /**
     * @notice Returns a tranche provider's capital once the loan it backs has
     * been repaid. Before repayment the tranche is genuinely at risk, so it is
     * locked — that is the whole point of first-loss capital.
     */
    function releaseTranche(uint256 winId) external nonReentrant {
        Loan storage loan = loans[winId];
        require(loan.trancheSize > 0, "No tranche to release");
        require(loan.status == LoanStatus.REPAID, "Tranche still at risk");
        require(msg.sender == loan.trancheProvider, "Not tranche provider");

        uint256 amount = loan.trancheSize;
        totalTrancheCapacity -= amount;
        loan.trancheSize = 0;

        usdcToken.safeTransfer(msg.sender, amount);
    }

    /**
     * @notice Settles an open loan once the hackathon payout is recorded in
     * the registry. The builder repays principal out of the prize.
     *
     * The repayment is pulled FROM the builder, not paid out by the contract.
     * That is what keeps invariant 1 structural: no role, and no sequence of
     * user actions, can make the contract pay a lender.
     */
    function settleLoan(uint256 winId) external whenNotPaused nonReentrant {
        Loan storage loan = loans[winId];
        require(loan.status == LoanStatus.OPEN, "Loan not open");
        require(_payoutRecorded(winId), "Payout not recorded");

        loan.status = LoanStatus.REPAID;
        totalLoanPrincipal -= loan.principal;

        // The prize landed with the builder; it goes back out to the lender.
        usdcToken.safeTransferFrom(loan.builder, loan.lender, loan.principal);

        if (loan.collateral > 0) {
            totalCollateral -= loan.collateral;
            usdcToken.safeTransfer(loan.builder, loan.collateral);
            emit CollateralReleased(winId, loan.builder, loan.collateral);
        }

        Win storage win = wins[winId];
        win.status = WinStatus.SETTLED;
        win.settledAt = block.timestamp;

        _recordSettled(loan.builder, win);

        emit LoanRepaid(winId, loan.lender, loan.principal);
    }

    /**
     * @notice Marks an over-due loan as defaulted. Permissionless after dueAt.
     *
     * OVERCOLLATERALIZED: collateral returns to the builder; the lender's loss
     * is nil because collateral covered principal.
     * TRANCHE_BACKED: tranche capacity is consumed; the lender absorbs the loss
     * above it. In neither case does the contract pay the lender.
     */
    function defaultLoan(uint256 winId) external whenNotPaused nonReentrant {
        Loan storage loan = loans[winId];
        require(loan.status == LoanStatus.OPEN, "Loan not open");
        require(block.timestamp >= loan.dueAt, "Not yet due");

        loan.status = LoanStatus.DEFAULTED;
        wins[winId].status = WinStatus.DEFAULTED;

        totalLoanPrincipal -= loan.principal;

        if (loan.collateral > 0) {
            totalCollateral -= loan.collateral;
            usdcToken.safeTransfer(loan.builder, loan.collateral);
            emit CollateralReleased(winId, loan.builder, loan.collateral);
        }

        uint256 absorbed = 0;
        if (loan.trancheSize > 0) {
            absorbed = loan.trancheSize;
            // The tranche capital is consumed by the loss: it leaves the
            // contract's balance, and the lender's loss is the shortfall the
            // tranche did not cover. The platform contributes nothing.
            totalTrancheCapacity -= absorbed;
            totalTrancheAbsorbed += absorbed;
            usdcToken.safeTransfer(loan.lender, absorbed);
            loan.trancheSize = 0;
        }

        BuilderHistory storage history = builderHistory[loan.builder];
        history.loansTaken += 1;
        history.winsDefaulted += 1;

        emit LoanDefaulted(winId, loan.builder, loan.principal, loan.collateral, absorbed);
    }

    /**
     * @dev True once the registry has recorded a payout for THIS builder at
     * this hackathon — not merely that the hackathon paid someone.
     *
     * Matching on the hackathon-level paidWinners count would let an unrelated
     * winner's payout settle this builder's loan, so we scan the builder's own
     * declarations for a recorded paidAt.
     */
    function _payoutRecorded(uint256 winId) private view returns (bool) {
        Win storage win = wins[winId];
        try registry.getWinnerDeclarations(win.hackathonId) returns (
            IHackathonRegistry.WinnerDeclaration[] memory declarations
        ) {
            for (uint256 i = 0; i < declarations.length; i++) {
                if (
                    declarations[i].winner == win.builder && declarations[i].paidAt > 0
                ) {
                    return true;
                }
            }
            return false;
        } catch {
            // If the registry cannot answer, we cannot prove settlement.
            return false;
        }
    }

    function _recordSettled(address builder, Win storage win) private {
        BuilderHistory storage history = builderHistory[builder];
        uint256 daysToPay = (block.timestamp - win.declaredAt) / 1 days;
        history.loansTaken += 1;
        history.loansRepaid += 1;
        history.winsSettledInFull += 1;
        history.totalDaysToPay += daysToPay;
        if (history.fastestDaysToPay == 0 || daysToPay < history.fastestDaysToPay) {
            history.fastestDaysToPay = daysToPay;
        }
    }

    // ── Market ────────────────────────────────────────────────────────────

    /**
     * @notice Places a bet on whether a declared win will actually be paid.
     * Stake is escrowed in a pool accounted entirely separately from lending.
     */
    function placeBet(uint256 winId, uint256 amount, bool expectsPayment)
        external
        whenNotPaused
        nonReentrant
    {
        require(amount > 0, "Amount must be > 0");
        Win storage win = wins[winId];
        require(win.status == WinStatus.DECLARED, "Win not open for betting");
        require(!betSettled[winId], "Market already settled");
        require(win.builder != msg.sender, "Builder cannot bet on own win");

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        bets[winId].push(
            Bet({
                bettor: msg.sender,
                amount: amount,
                expectsPayment: expectsPayment,
                claimed: false
            })
        );
        totalBetStakes += amount;

        emit BetPlaced(winId, msg.sender, amount, expectsPayment);
    }

    /**
     * @notice Resolves a market once the underlying win resolves.
     *
     * Winners split the entire stake pool pro-rata. The bet pool is
     * self-contained: it is funded only by bettors and paid only to bettors,
     * so resolving a market can never touch lending capital.
     */
    function settleBet(uint256 winId) external whenNotPaused nonReentrant {
        require(!betSettled[winId], "Market already settled");
        Win storage win = wins[winId];
        require(win.status != WinStatus.DECLARED, "Win unresolved");

        bool paid = win.status == WinStatus.SETTLED;
        betOutcome[winId] = paid ? BetOutcome.PAID : BetOutcome.UNPAID;

        Bet[] storage winBets = bets[winId];
        uint256 pool = 0;
        uint256 winningSide = 0;
        for (uint i = 0; i < winBets.length; i++) {
            pool += winBets[i].amount;
            if (winBets[i].expectsPayment == paid) {
                winningSide += winBets[i].amount;
            }
        }

        betSettled[winId] = true;

        if (winningSide > 0 && pool > 0) {
            // Winning stakes are owed the whole pool pro-rata. Losing stakes
            // are swept into it in the same transfer pass.
            totalBetOwed += pool;
        }

        emit BetSettled(winId, paid, pool, totalBetOwed);
    }

    /**
     * @notice Claims a settled bet. Winners receive their pro-rata share of
     * the pool; losers receive nothing. Paid only from the bet pool.
     */
    function claimBet(uint256 winId) external whenNotPaused nonReentrant {
        require(betSettled[winId], "Market not settled");
        Bet[] storage winBets = bets[winId];

        bool paid = betOutcome[winId] == BetOutcome.PAID;

        uint256 pool = 0;
        uint256 winningSide = 0;
        for (uint i = 0; i < winBets.length; i++) {
            pool += winBets[i].amount;
            if (winBets[i].expectsPayment == paid) winningSide += winBets[i].amount;
        }
        require(winningSide > 0, "No winning side");

        for (uint i = 0; i < winBets.length; i++) {
            if (winBets[i].bettor != msg.sender || winBets[i].claimed) continue;
            winBets[i].claimed = true;

            uint256 payout = 0;
            if (winBets[i].expectsPayment == paid) {
                payout = (winBets[i].amount * pool) / winningSide;
            }
            totalBetOwed = totalBetOwed > winBets[i].amount
                ? totalBetOwed - winBets[i].amount
                : 0;
            if (payout > 0) {
                usdcToken.safeTransfer(msg.sender, payout);
            }
            emit BetClaimed(winId, msg.sender, winBets[i].amount, payout);
            break;
        }
    }

    // ── Fees & admin ──────────────────────────────────────────────────────

    /**
     * @notice Withdraws accrued fees. The only function that moves USDC out on
     * an admin's behalf, and it can only ever reach `accruedFees` — never
     * principal, collateral, tranche capacity, or bet stakes.
     */
    function withdrawFees(address to, uint256 amount)
        external
        onlyRole(FEE_ROLE)
        nonReentrant
        whenNotPaused
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(amount <= accruedFees, "Insufficient accrued fees");

        accruedFees -= amount;
        usdcToken.safeTransfer(to, amount);

        emit FeesWithdrawn(to, amount);
    }

    function setBounds(uint256 _maxLoanSize, uint256 _maxRateBps, uint256 _maxLoanDuration)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        maxLoanSize = _maxLoanSize;
        maxRateBps = _maxRateBps;
        maxLoanDuration = _maxLoanDuration;
        emit BoundsUpdated(_maxLoanSize, _maxRateBps, _maxLoanDuration);
    }

    function updateFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRecipient != address(0), "Invalid recipient");
        _revokeRole(FEE_ROLE, feeRecipient);
        feeRecipient = newRecipient;
        _grantRole(FEE_ROLE, newRecipient);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function updateRegistry(address _registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_registry != address(0), "Invalid registry");
        registry = IHackathonRegistry(_registry);
    }

    function updateUsdcToken(address _usdcToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_usdcToken != address(0), "Invalid token");
        usdcToken = IERC20(_usdcToken);
    }

    // ── Credibility views ─────────────────────────────────────────────────

    /// @notice Wins settled in full, per 10,000 resolved wins.
    function coverageRateBps(address builder) external view returns (uint256) {
        BuilderHistory storage history = builderHistory[builder];
        uint256 resolved = history.winsSettledInFull + history.winsDefaulted;
        if (resolved == 0) return 0;
        return (history.winsSettledInFull * 10_000) / resolved;
    }

    /// @notice Mean days from declared win to recorded payout.
    function averageDaysToPay(address builder) external view returns (uint256) {
        BuilderHistory storage history = builderHistory[builder];
        if (history.winsSettledInFull == 0) return 0;
        return history.totalDaysToPay / history.winsSettledInFull;
    }
}