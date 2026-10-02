// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/IHackathonRegistry.sol";

/**
 * @title BuilderCreditCore
 * @dev Core contract for the PledgeBond platform
 * Manages credit lines, projects, milestones, and funding
 *
 * UUPS upgradeable — deploy via hardhat-upgrades deployProxy.
 * _authorizeUpgrade is gated to DEFAULT_ADMIN_ROLE.
 * initialize() replaces the constructor pattern.
 *
 * IMPORTANT: When upgrading, new versions must preserve storage layout.
 * Append new storage variables at the end — do NOT reorder or remove existing ones.
 */
contract BuilderCreditCore is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // Roles
    bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant SCORER_ROLE = keccak256("SCORER_ROLE");

    // ── Storage ──────────────────────────────────────────────────
    // WARNING: Storage layout is fixed after first deploy.
    // Append new variables at the end; never reorder or delete.

    Counters.Counter private _projectIdCounter;

    IHackathonRegistry public registry;
    IERC20 public usdcToken;

    uint256 public constant MIN_CREDIT_SCORE = 400;
    uint256 public constant MAX_CREDIT_SCORE = 850;
    uint256 public baseCreditAmount;
    uint256 public creditMultiplier;
    uint256 public maxCreditAmount;

    struct Project {
        uint256[] hackathonIds;
        address developer;
        string githubUrl;
        string name;
        uint256 fundingAmount;
        bool isActive;
        uint256 fundedAt;
        uint256 creditScore;
        uint256 milestonesCompleted;
        uint256 milestonesCount;
    }

    struct Backing {
        address backer;
        uint256 amount;
        uint256 multiplier;
        bool claimed;
    }

    struct Milestone {
        string description;
        uint256 amount;
        bool completed;
        uint256 completedAt;
    }

    struct CheckIn {
        uint256 timestamp;
        string metadata;
    }

    struct TeamMember {
        address member;
        uint256 share;
    }

    struct MilestoneApproval {
        mapping(address => bool) hasApproved;
        uint8 approvalCount;
        mapping(uint256 => uint8) approvalCountByHackathon;
        bool isCompleted;
    }

    struct CreditLine {
        uint256 totalAmount;
        uint256 usedAmount;
        uint256 reputation;
        bool active;
        uint256 lastUpdated;
    }

    mapping(uint256 => Project) public projects;
    mapping(uint256 => Backing[]) public projectBackings;
    mapping(uint256 => CheckIn[]) public projectCheckIns;
    mapping(uint256 => uint256) public totalProjectBacking;
    mapping(uint256 => uint256) public projectPledgedPrize;
    mapping(uint256 => Milestone[]) public projectMilestones;
    mapping(uint256 => TeamMember[]) public projectTeams;
    mapping(uint256 => mapping(uint256 => MilestoneApproval)) public approvals;
    mapping(address => uint256[]) public developerProjects;
    mapping(address => uint256[]) public backerProjects;
    mapping(address => CreditLine) public creditLines;

    // Project ID => USDC deposited for prize payouts (pull-based)
    mapping(uint256 => uint256) public projectPrizePool;

    // Project ID => USDC still owed to backers who have not claimed
    mapping(uint256 => uint256) public projectPrizeOwed;

    // Sum of all projectPrizePool entries; reserved and not withdrawable
    uint256 public totalPrizePools;

    // Launch safety limits (PLATFORM_ADMIN adjustable)
    uint256 public maxBackingPerTx;
    uint256 public backingRefundDelay;
    uint256 public checkInInterval;
    uint256 public maxCheckInReputation;

    // Project ID => timestamp of last check-in (rate limits reputation farming)
    mapping(uint256 => uint256) public lastCheckInAt;

    // Developer => reputation points earned from check-ins (capped)
    mapping(address => uint256) public checkInReputationEarned;

    // Events
    event ProjectCreated(
        uint256 indexed projectId,
        uint256[] hackathonIds,
        address indexed developer,
        uint256 amount,
        string name
    );

    event ProjectBacked(
        uint256 indexed projectId,
        address indexed backer,
        uint256 amount,
        uint256 multiplier
    );

    event CheckInPosted(
        uint256 indexed projectId,
        uint256 timestamp,
        string metadata
    );

    event PrizePledged(
        uint256 indexed projectId,
        uint256 amount
    );

    event PrizeFunded(
        uint256 indexed projectId,
        uint256 amount,
        uint256 totalPool
    );
    event BackerPayoutClaimed(
        uint256 indexed projectId,
        address indexed backer,
        uint256 payout,
        uint256 owed
    );
    event BuilderPayoutClaimed(
        uint256 indexed projectId,
        address indexed developer,
        uint256 payout
    );
    event BackingRefunded(
        uint256 indexed projectId,
        address indexed backer,
        uint256 amount
    );
    event LimitsUpdated(
        uint256 maxBackingPerTx,
        uint256 backingRefundDelay,
        uint256 checkInInterval,
        uint256 maxCheckInReputation
    );

    event MilestoneCompleted(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        uint256 amount,
        address indexed developer
    );

    event MilestoneApproved(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        address indexed verifier
    );

    event CreditLineUpdated(
        address indexed developer,
        uint256 totalAmount,
        uint256 usedAmount,
        uint256 reputation
    );

    event ReputationUpdated(
        address indexed developer,
        uint256 oldReputation,
        uint256 newReputation
    );
    event LoanRepaid(address indexed developer, uint256 amount);
    event FundsWithdrawn(address token, address to, uint256 amount);
    event CreditParametersUpdated(
        uint256 base,
        uint256 multiplier,
        uint256 max
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract (replaces constructor for UUPS proxy pattern).
     * @param _registry Address of the HackathonRegistry contract
     * @param _usdcToken Address of the USDC token contract
     * @param _admin Address that receives all default admin roles
     */
    function initialize(
        address _registry,
        address _usdcToken,
        address _admin
    ) external initializer {
        require(_registry != address(0), "Invalid registry address");
        require(_usdcToken != address(0), "Invalid token address");
        require(_admin != address(0), "Invalid admin address");

        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        registry = IHackathonRegistry(_registry);
        usdcToken = IERC20(_usdcToken);

        baseCreditAmount = 500 * 1e6; // 500 USDC
        creditMultiplier = 10 * 1e6; // Legacy, unused in logic
        maxCreditAmount = 5000 * 1e6; // 5,000 USDC

        maxBackingPerTx = 1000 * 1e6; // 1,000 USDC per backing transaction
        backingRefundDelay = 30 days;
        checkInInterval = 1 days;
        maxCheckInReputation = 50;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PLATFORM_ADMIN_ROLE, _admin);
        _grantRole(TREASURY_ROLE, _admin);
        _grantRole(SCORER_ROLE, _admin);
    }

    /**
     * @dev UUPS: only DEFAULT_ADMIN_ROLE can authorize an upgrade.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ── Core functions ───────────────────────────────────────────

    /**
     * @dev Repays a loan for a developer
     * @param amount Amount of USDC to repay
     */
    function repayLoan(
        uint256 amount
    ) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        CreditLine storage creditLine = creditLines[msg.sender];
        require(creditLine.active, "No active credit line");
        require(
            amount <= creditLine.usedAmount,
            "Repayment exceeds used amount"
        );

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 oldReputation = creditLine.reputation;
        creditLine.usedAmount -= amount;

        uint256 repGain = amount / 100e6;
        if (repGain > 0) {
            creditLine.reputation += repGain;
            if (creditLine.reputation > MAX_CREDIT_SCORE) {
                creditLine.reputation = MAX_CREDIT_SCORE;
            }
        }

        creditLine.lastUpdated = block.timestamp;

        emit LoanRepaid(msg.sender, amount);
        emit CreditLineUpdated(
            msg.sender,
            creditLine.totalAmount,
            creditLine.usedAmount,
            creditLine.reputation
        );

        if (creditLine.reputation > oldReputation) {
            emit ReputationUpdated(
                msg.sender,
                oldReputation,
                creditLine.reputation
            );
        }
    }

    /**
     * @dev Requests funding for a project
     */
    function requestFunding(
        uint256[] calldata hackathonIds,
        string calldata githubUrl,
        string calldata projectName,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestoneAmounts
    ) external whenNotPaused nonReentrant returns (uint256) {
        return
            _requestFunding(
                hackathonIds,
                githubUrl,
                projectName,
                milestoneDescriptions,
                milestoneAmounts
            );
    }

    function _requestFunding(
        uint256[] calldata hackathonIds,
        string calldata githubUrl,
        string calldata projectName,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestoneAmounts
    ) internal returns (uint256) {
        require(bytes(githubUrl).length > 0, "GitHub URL cannot be empty");
        require(
            bytes(projectName).length > 0,
            "Project name cannot be empty"
        );
        require(
            milestoneDescriptions.length == milestoneAmounts.length,
            "Mismatched milestone arrays"
        );
        require(
            milestoneDescriptions.length > 0,
            "No milestones provided"
        );
        require(hackathonIds.length > 0, "At least one hackathon required");
        require(hackathonIds.length <= 5, "Too many hackathons");

        for (uint i = 0; i < hackathonIds.length; i++) {
            require(
                registry.hackathonExists(hackathonIds[i]),
                "Hackathon does not exist"
            );
        }

        uint256 totalAmount = 0;
        for (uint i = 0; i < milestoneAmounts.length; i++) {
            require(
                milestoneAmounts[i] > 0,
                "Milestone amount must be greater than 0"
            );
            totalAmount += milestoneAmounts[i];
        }

        uint256 effectiveCreditScore = _getVerifiedCreditScore(msg.sender);
        uint256 maxFunding = calculateFundingAmount(effectiveCreditScore);
        require(
            totalAmount <= maxFunding,
            "Requested amount exceeds credit limit"
        );

        _updateCreditLine(msg.sender, effectiveCreditScore, totalAmount);

        _projectIdCounter.increment();
        uint256 projectId = _projectIdCounter.current();

        projects[projectId] = Project({
            hackathonIds: hackathonIds,
            developer: msg.sender,
            githubUrl: githubUrl,
            name: projectName,
            fundingAmount: totalAmount,
            isActive: true,
            fundedAt: block.timestamp,
            creditScore: effectiveCreditScore,
            milestonesCompleted: 0,
            milestonesCount: milestoneDescriptions.length
        });

        for (uint i = 0; i < milestoneDescriptions.length; i++) {
            projectMilestones[projectId].push(
                Milestone({
                    description: milestoneDescriptions[i],
                    amount: milestoneAmounts[i],
                    completed: false,
                    completedAt: 0
                })
            );
        }

        developerProjects[msg.sender].push(projectId);

        emit ProjectCreated(
            projectId,
            hackathonIds,
            msg.sender,
            totalAmount,
            projectName
        );

        return projectId;
    }

    /**
     * @dev Requests funding for a project with a team
     */
    function requestFundingWithTeam(
        uint256[] calldata hackathonIds,
        string calldata githubUrl,
        string calldata projectName,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestoneAmounts,
        address[] calldata teamMembers,
        uint256[] calldata teamShares
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(
            teamMembers.length == teamShares.length,
            "Mismatched team arrays"
        );
        require(teamMembers.length <= 10, "Too many team members");

        uint256 totalShares = 0;
        for (uint i = 0; i < teamShares.length; i++) {
            totalShares += teamShares[i];
        }
        require(totalShares == 10000, "Total shares must be 100%");

        uint256 projectId = _requestFunding(
            hackathonIds,
            githubUrl,
            projectName,
            milestoneDescriptions,
            milestoneAmounts
        );

        for (uint i = 0; i < teamMembers.length; i++) {
            // Arc reverts on transfers to address(0); validate up front so a
            // zero member cannot permanently DoS milestone payouts.
            require(teamMembers[i] != address(0), "Invalid team member");
            projectTeams[projectId].push(
                TeamMember({member: teamMembers[i], share: teamShares[i]})
            );
        }

        return projectId;
    }

    /**
     * @dev Approves a milestone for a project
     */
    function approveMilestone(
        uint256 projectId,
        uint256 milestoneId
    ) external whenNotPaused nonReentrant {
        Project storage project = projects[projectId];
        require(project.isActive, "Project is not active");

        require(
            milestoneId < projectMilestones[projectId].length,
            "Invalid milestone ID"
        );
        Milestone storage milestone = projectMilestones[projectId][milestoneId];
        require(!milestone.completed, "Milestone already completed");

        MilestoneApproval storage approval = approvals[projectId][milestoneId];
        require(
            !approval.hasApproved[msg.sender],
            "Already approved by this verifier"
        );

        approval.hasApproved[msg.sender] = true;
        approval.approvalCount++;

        emit MilestoneApproved(projectId, milestoneId, msg.sender);

        // Approvals accumulate per hackathon: a milestone completes only when
        // one listed hackathon reaches its own required signature count.
        bool isAuthorized = false;
        for (uint i = 0; i < project.hackathonIds.length; i++) {
            uint256 hId = project.hackathonIds[i];
            if (registry.isVerifier(hId, msg.sender)) {
                isAuthorized = true;
                uint8 count = ++approval.approvalCountByHackathon[hId];
                if (count >= registry.getRequiredSignatures(hId)) {
                    _completeMilestone(projectId, milestoneId);
                    break;
                }
            }
        }
        require(isAuthorized, "Not an authorized verifier");
    }

    function _completeMilestone(uint256 projectId, uint256 milestoneId) internal {
        Milestone storage milestone = projectMilestones[projectId][milestoneId];
        milestone.completed = true;
        milestone.completedAt = block.timestamp;
        approvals[projectId][milestoneId].isCompleted = true;

        // Milestone payouts cannot touch deposited prize pools, which are
        // reserved for backer and builder claims.
        require(
            usdcToken.balanceOf(address(this)) >=
                milestone.amount + totalPrizePools,
            "Insufficient unreserved balance"
        );

        Project storage project = projects[projectId];
        project.milestonesCompleted++;

        if (project.milestonesCompleted == project.milestonesCount) {
            project.isActive = false;
        }

        TeamMember[] storage team = projectTeams[projectId];
        if (team.length > 0) {
            uint256 remainingAmount = milestone.amount;
            for (uint i = 0; i < team.length; i++) {
                uint256 memberAmount = (milestone.amount * team[i].share) / 10000;
                if (memberAmount > 0) {
                    usdcToken.safeTransfer(team[i].member, memberAmount);
                    remainingAmount -= memberAmount;
                }
            }
            if (remainingAmount > 0) {
                usdcToken.safeTransfer(project.developer, remainingAmount);
            }
        } else {
            usdcToken.safeTransfer(project.developer, milestone.amount);
        }

        CreditLine storage creditLine = creditLines[project.developer];
        creditLine.reputation += 1;
        creditLine.lastUpdated = block.timestamp;

        emit MilestoneCompleted(
            projectId,
            milestoneId,
            milestone.amount,
            project.developer
        );
    }

    function _updateCreditLine(
        address developer,
        uint256 reputation,
        uint256 requestedAmount
    ) internal {
        CreditLine storage creditLine = creditLines[developer];

        if (creditLine.lastUpdated == 0) {
            creditLine.totalAmount = calculateFundingAmount(reputation);
            creditLine.reputation = reputation;
            creditLine.active = true;
        } else if (reputation > creditLine.reputation) {
            creditLine.totalAmount = calculateFundingAmount(reputation);
            creditLine.reputation = reputation;
        }

        // Aggregate exposure cap: total outstanding across all of the
        // developer's projects cannot exceed their current credit line.
        require(
            creditLine.usedAmount + requestedAmount <= creditLine.totalAmount,
            "Exceeds credit line"
        );

        creditLine.usedAmount += requestedAmount;
        creditLine.lastUpdated = block.timestamp;

        emit CreditLineUpdated(
            developer,
            creditLine.totalAmount,
            creditLine.usedAmount,
            creditLine.reputation
        );
    }

    /**
     * @dev Backs a project with USDC
     */
    function backProject(
        uint256 projectId,
        uint256 multiplier,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        Project storage project = projects[projectId];
        require(project.isActive, "Project not active");
        require(amount > 0, "Amount must be > 0");
        require(
            amount <= maxBackingPerTx,
            "Amount exceeds per-transaction limit"
        );

        uint256 maxAllowedMultiplier = getMaxMultiplier(project.creditScore);
        require(
            multiplier <= maxAllowedMultiplier,
            "Multiplier exceeds allowed limit for this builder's reputation"
        );
        require(multiplier >= 100, "Invalid multiplier");

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        projectBackings[projectId].push(
            Backing({
                backer: msg.sender,
                amount: amount,
                multiplier: multiplier,
                claimed: false
            })
        );

        totalProjectBacking[projectId] += amount;
        projectPrizeOwed[projectId] += (amount * multiplier) / 100;
        backerProjects[msg.sender].push(projectId);

        CreditLine storage creditLine = creditLines[project.developer];
        creditLine.totalAmount += (amount * 2);

        emit ProjectBacked(projectId, msg.sender, amount, multiplier);
    }

    /**
     * @dev Pledges expected prize for a project
     */
    function pledgePrize(
        uint256 projectId,
        uint256 amount
    ) external whenNotPaused {
        require(
            projects[projectId].developer == msg.sender,
            "Only developer can pledge"
        );
        projectPledgedPrize[projectId] = amount;
        emit PrizePledged(projectId, amount);
    }

    /**
     * @dev Deposits a prize into the project's pool. Backers claim their
     * share via claimPayout and the developer claims the remainder via
     * claimBuilderPayout. Pull-based so payout cannot be DoS'd by a large
     * backer set or a reverting recipient (e.g. a blocklisted address).
     */
    function fundPrize(
        uint256 projectId,
        uint256 prizeAmount
    ) external onlyRole(TREASURY_ROLE) nonReentrant whenNotPaused {
        require(prizeAmount > 0, "Prize amount must be > 0");
        // Existence check, not isActive: prizes typically arrive after the
        // final milestone completes and the project deactivates.
        require(
            projects[projectId].developer != address(0),
            "Project does not exist"
        );

        usdcToken.safeTransferFrom(msg.sender, address(this), prizeAmount);
        projectPrizePool[projectId] += prizeAmount;
        totalPrizePools += prizeAmount;

        emit PrizeFunded(
            projectId,
            prizeAmount,
            projectPrizePool[projectId]
        );
    }

    /**
     * @dev Claims the caller's backer payout for a project. If the prize
     * pool is underfunded relative to total owed, pays a pro-rata share of
     * the pool rather than first-come-first-served.
     */
    function claimPayout(
        uint256 projectId
    ) external nonReentrant whenNotPaused {
        Backing[] storage backings = projectBackings[projectId];
        uint256 owed = 0;
        for (uint i = 0; i < backings.length; i++) {
            if (
                backings[i].backer == msg.sender && !backings[i].claimed
            ) {
                backings[i].claimed = true;
                owed += (backings[i].amount * backings[i].multiplier) / 100;
            }
        }
        require(owed > 0, "Nothing to claim");

        uint256 pool = projectPrizePool[projectId];
        require(pool > 0, "No prize funded");
        uint256 owedTotal = projectPrizeOwed[projectId];

        uint256 payout = owedTotal > pool
            ? (owed * pool) / owedTotal
            : owed;

        projectPrizePool[projectId] = pool - payout;
        totalPrizePools -= payout;
        projectPrizeOwed[projectId] = owedTotal - owed;

        usdcToken.safeTransfer(msg.sender, payout);
        emit BackerPayoutClaimed(projectId, msg.sender, payout, owed);
    }

    /**
     * @dev Claims the developer's share of the prize pool: anything in
     * excess of what is still owed to unclaimed backers.
     */
    function claimBuilderPayout(
        uint256 projectId
    ) external nonReentrant whenNotPaused {
        require(
            msg.sender == projects[projectId].developer,
            "Only developer can claim"
        );

        uint256 pool = projectPrizePool[projectId];
        uint256 owed = projectPrizeOwed[projectId];
        require(pool > owed, "No builder payout available");

        uint256 payout = pool - owed;
        projectPrizePool[projectId] = owed;
        totalPrizePools -= payout;

        usdcToken.safeTransfer(msg.sender, payout);
        emit BuilderPayoutClaimed(projectId, msg.sender, payout);
    }

    /**
     * @dev Refunds the caller's backing if the project has not deployed any
     * capital (no completed milestones) and no prize has been funded, after
     * backingRefundDelay has elapsed since the project was funded.
     */
    function refundBacking(
        uint256 projectId
    ) external nonReentrant whenNotPaused {
        Project storage project = projects[projectId];
        require(
            project.milestonesCompleted == 0,
            "Backing already deployed"
        );
        require(
            projectPrizePool[projectId] == 0,
            "Prize funded; claim payout instead"
        );
        require(
            block.timestamp >= project.fundedAt + backingRefundDelay,
            "Refund delay not elapsed"
        );

        Backing[] storage backings = projectBackings[projectId];
        uint256 refund = 0;
        uint256 owedRemoved = 0;
        for (uint i = 0; i < backings.length; i++) {
            if (
                backings[i].backer == msg.sender && !backings[i].claimed
            ) {
                backings[i].claimed = true;
                refund += backings[i].amount;
                owedRemoved +=
                    (backings[i].amount * backings[i].multiplier) / 100;
            }
        }
        require(refund > 0, "Nothing to refund");

        totalProjectBacking[projectId] -= refund;
        projectPrizeOwed[projectId] -= owedRemoved;

        uint256 boost = refund * 2;
        CreditLine storage line = creditLines[project.developer];
        line.totalAmount = line.totalAmount > boost
            ? line.totalAmount - boost
            : 0;

        usdcToken.safeTransfer(msg.sender, refund);
        emit BackingRefunded(projectId, msg.sender, refund);
    }

    /**
     * @dev Calculates funding amount based on credit score
     */
    function calculateFundingAmount(
        uint256 creditScore
    ) public view returns (uint256) {
        if (creditScore < MIN_CREDIT_SCORE) {
            return 0;
        }

        if (creditScore >= 800) {
            return maxCreditAmount;
        }

        uint256 minFunding = baseCreditAmount;
        uint256 fundingRange = maxCreditAmount - minFunding;
        uint256 scoreRange = 800 - MIN_CREDIT_SCORE;
        uint256 adjustedScore = creditScore - MIN_CREDIT_SCORE;

        return minFunding + (fundingRange * adjustedScore) / scoreRange;
    }

    function setReputation(
        address developer,
        uint256 reputation
    ) external onlyRole(SCORER_ROLE) {
        require(developer != address(0), "Invalid developer");
        require(
            reputation >= MIN_CREDIT_SCORE &&
                reputation <= MAX_CREDIT_SCORE,
            "Reputation must be within valid range"
        );

        uint256 oldReputation = creditLines[developer].reputation;
        creditLines[developer].reputation = reputation;

        if (creditLines[developer].lastUpdated != 0) {
            creditLines[developer].totalAmount = calculateFundingAmount(
                reputation
            );
            creditLines[developer].lastUpdated = block.timestamp;
        }

        emit ReputationUpdated(developer, oldReputation, reputation);
        emit CreditLineUpdated(
            developer,
            creditLines[developer].totalAmount,
            creditLines[developer].usedAmount,
            reputation
        );
    }

    function _getVerifiedCreditScore(
        address developer
    ) internal view returns (uint256) {
        uint256 score = creditLines[developer].reputation;
        require(
            score >= MIN_CREDIT_SCORE,
            "Credit score not verified"
        );
        return score;
    }

    /**
     * @dev Posts a project check-in (Proof of Activity)
     */
    function postCheckIn(
        uint256 projectId,
        string calldata metadata
    ) external whenNotPaused {
        require(
            projects[projectId].developer == msg.sender,
            "Only developer can check-in"
        );
        require(projects[projectId].isActive, "Project is not active");
        require(
            block.timestamp >= lastCheckInAt[projectId] + checkInInterval,
            "Check-in interval not elapsed"
        );

        lastCheckInAt[projectId] = block.timestamp;
        projectCheckIns[projectId].push(
            CheckIn({
                timestamp: block.timestamp,
                metadata: metadata
            })
        );

        // Check-in reputation is rate-limited and capped so it cannot be
        // farmed to unlock funding tiers.
        if (checkInReputationEarned[msg.sender] < maxCheckInReputation) {
            creditLines[msg.sender].reputation += 1;
            checkInReputationEarned[msg.sender] += 1;
            if (creditLines[msg.sender].reputation > MAX_CREDIT_SCORE) {
                creditLines[msg.sender].reputation = MAX_CREDIT_SCORE;
            }
        }

        emit CheckInPosted(projectId, block.timestamp, metadata);
    }

    /**
     * @dev Calculates boosted funding amount including backer confidence
     */
    function calculateBoostedFundingAmount(
        uint256 creditScore,
        uint256 projectId
    ) public view returns (uint256) {
        uint256 baseAmount = calculateFundingAmount(creditScore);
        uint256 boostedAmount = baseAmount + (2 * totalProjectBacking[projectId]);
        uint256 currentMax = maxCreditAmount + totalProjectBacking[projectId];
        return boostedAmount > currentMax ? currentMax : boostedAmount;
    }

    /**
     * @dev Returns the maximum allowed multiplier based on credit score
     */
    function getMaxMultiplier(
        uint256 creditScore
    ) public pure returns (uint256) {
        if (creditScore >= 800) {
            return 150;
        } else if (creditScore >= 700) {
            return 200;
        } else if (creditScore >= 600) {
            return 250;
        } else {
            return 300;
        }
    }

    /**
     * @dev Updates credit calculation parameters
     */
    function updateCreditParameters(
        uint256 _baseCreditAmount,
        uint256 _creditMultiplier,
        uint256 _maxCreditAmount
    ) external onlyRole(PLATFORM_ADMIN_ROLE) {
        baseCreditAmount = _baseCreditAmount;
        creditMultiplier = _creditMultiplier;
        maxCreditAmount = _maxCreditAmount;

        emit CreditParametersUpdated(
            _baseCreditAmount,
            _creditMultiplier,
            _maxCreditAmount
        );
    }

    /**
     * @dev Withdraws funds from the contract
     */
    function withdrawFunds(
        address token,
        uint256 amount
    ) external onlyRole(TREASURY_ROLE) nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        IERC20 tokenContract = IERC20(token);
        require(
            tokenContract.balanceOf(address(this)) >= amount,
            "Insufficient balance"
        );
        if (token == address(usdcToken)) {
            require(
                tokenContract.balanceOf(address(this)) >=
                    amount + totalPrizePools,
                "Cannot withdraw prize pools"
            );
        }

        tokenContract.safeTransfer(msg.sender, amount);

        emit FundsWithdrawn(token, msg.sender, amount);
    }

    /**
     * @dev Updates launch safety limits
     */
    function setLimits(
        uint256 _maxBackingPerTx,
        uint256 _backingRefundDelay,
        uint256 _checkInInterval,
        uint256 _maxCheckInReputation
    ) external onlyRole(PLATFORM_ADMIN_ROLE) {
        maxBackingPerTx = _maxBackingPerTx;
        backingRefundDelay = _backingRefundDelay;
        checkInInterval = _checkInInterval;
        maxCheckInReputation = _maxCheckInReputation;

        emit LimitsUpdated(
            _maxBackingPerTx,
            _backingRefundDelay,
            _checkInInterval,
            _maxCheckInReputation
        );
    }

    function getBackerProjects(
        address backer
    ) external view returns (uint256[] memory) {
        return backerProjects[backer];
    }

    function getProjectMilestones(
        uint256 projectId
    ) external view returns (Milestone[] memory) {
        return projectMilestones[projectId];
    }

    function getProjectCheckIns(
        uint256 projectId
    ) external view returns (CheckIn[] memory) {
        return projectCheckIns[projectId];
    }

    function getDeveloperProjects(
        address developer
    ) external view returns (uint256[] memory) {
        return developerProjects[developer];
    }

    function getMilestoneApprovalStatus(
        uint256 projectId,
        uint256 milestoneId,
        address verifier
    )
        external
        view
        returns (bool hasApproved, uint8 approvalCount, bool isCompleted)
    {
        MilestoneApproval storage approval = approvals[projectId][milestoneId];
        return (
            approval.hasApproved[verifier],
            approval.approvalCount,
            approval.isCompleted
        );
    }

    function getProjectBackerCount(
        uint256 projectId
    ) external view returns (uint256) {
        return projectBackings[projectId].length;
    }

    function pause() external onlyRole(PLATFORM_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PLATFORM_ADMIN_ROLE) {
        _unpause();
    }

    function updateRegistry(
        address _registry
    ) external onlyRole(PLATFORM_ADMIN_ROLE) {
        require(_registry != address(0), "Invalid registry address");
        registry = IHackathonRegistry(_registry);
    }

    function updateUsdcToken(
        address _usdcToken
    ) external onlyRole(PLATFORM_ADMIN_ROLE) {
        require(_usdcToken != address(0), "Invalid token address");
        usdcToken = IERC20(_usdcToken);
    }
}
