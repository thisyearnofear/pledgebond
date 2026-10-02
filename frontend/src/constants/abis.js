/**
 * Common ABIs for interacting with contracts
 */

// ERC20 Token Standard ABI (minimal interface)
export const ERC20_ABI = [
  // Read-only functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// ERC721 NFT Standard ABI (minimal interface)
export const ERC721_ABI = [
  // Read-only functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)"
];

// Generic Contract Interface for detecting contract type
export const DETECTION_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function tokenURI(uint256) view returns (string)",
  "function ownerOf(uint256) view returns (address)"
];

// BuilderCreditCore ABI
export const BUILDER_CREDIT_CORE_ABI = [
  "function requestFunding(uint256[] hackathonIds, string githubUrl, string projectName, string[] milestoneDescriptions, uint256[] milestoneAmounts) external returns (uint256)",
  "function requestFundingWithTeam(uint256[] hackathonIds, string githubUrl, string projectName, string[] milestoneDescriptions, uint256[] milestoneAmounts, address[] teamMembers, uint256[] teamShares) external returns (uint256)",
  "function backProject(uint256 projectId, uint256 multiplier, uint256 amount) external",
  "function pledgePrize(uint256 projectId, uint256 amount) external",
  "function fundPrize(uint256 projectId, uint256 prizeAmount) external",
  "function claimPayout(uint256 projectId) external",
  "function claimBuilderPayout(uint256 projectId) external",
  "function refundBacking(uint256 projectId) external",
  "function projectPrizePool(uint256 projectId) public view returns (uint256)",
  "function projectPrizeOwed(uint256 projectId) public view returns (uint256)",
  "function maxBackingPerTx() public view returns (uint256)",
  "function backingRefundDelay() public view returns (uint256)",
  "function approveMilestone(uint256 projectId, uint256 milestoneId) external",
  "function calculateFundingAmount(uint256 creditScore) public view returns (uint256)",
  "function calculateBoostedFundingAmount(uint256 creditScore, uint256 projectId) public view returns (uint256)",
  "function getMaxMultiplier(uint256 creditScore) public pure returns (uint256)",
  "function totalProjectBacking(uint256 projectId) public view returns (uint256)",
  "function projectPledgedPrize(uint256 projectId) public view returns (uint256)",
  "function projects(uint256 projectId) public view returns (uint256[] hackathonIds, address developer, string githubUrl, string name, uint256 fundingAmount, bool isActive, uint256 fundedAt, uint256 creditScore, uint256 milestonesCompleted, uint256 milestonesCount)",
  "function getDeveloperProjects(address developer) external view returns (uint256[] memory)",
  "function getBackerProjects(address backer) external view returns (uint256[] memory)",
  "function getProjectMilestones(uint256 projectId) external view returns (tuple(string description, uint256 amount, bool completed, uint256 completedAt)[] memory)",
  "function getMilestoneApprovalStatus(uint256 projectId, uint256 milestoneId, address verifier) external view returns (bool hasApproved, uint8 approvalCount, bool isCompleted)",
  "function projectBackings(uint256 projectId, uint256 backingId) public view returns (address backer, uint256 amount, uint256 multiplier, bool claimed)",
  "function creditLines(address developer) public view returns (uint256 totalAmount, uint256 usedAmount, uint256 reputation, bool active, uint256 lastUpdated)",
  "event ProjectCreated(uint256 indexed projectId, uint256[] hackathonIds, address indexed developer, uint256 amount, string name)",
  "event ProjectBacked(uint256 indexed projectId, address indexed backer, uint256 amount, uint256 multiplier)",
  "event PrizeFunded(uint256 indexed projectId, uint256 amount, uint256 totalPool)",
  "event BackerPayoutClaimed(uint256 indexed projectId, address indexed backer, uint256 payout, uint256 owed)",
  "event BuilderPayoutClaimed(uint256 indexed projectId, address indexed developer, uint256 payout)",
  "event BackingRefunded(uint256 indexed projectId, address indexed backer, uint256 amount)"
];

// HackathonRegistry ABI
export const HACKATHON_REGISTRY_ABI = [
  "function isVerifier(uint256 hackathonId, address account) external view returns (bool)",
  "function getRequiredSignatures(uint256 hackathonId) external view returns (uint256)",
  "function getHackathonVerifiers(uint256 hackathonId) external view returns (address[] memory)",
  "function getHackathonIdByName(string name) external view returns (uint256)",
  "function getHackathonDetails(uint256 hackathonId) external view returns (string name, address organizer, uint256 startDate, uint256 endDate, bool isActive)",
  "function hackathons(uint256 hackathonId) public view returns (address host, uint8 requiredSignatures, bool active, uint256 startDate, uint256 endDate, uint256 createdAt, string name)",
  "event HackathonCreated(uint256 indexed hackathonId, string name, address host, uint8 requiredSignatures)",
  "event VerifierAdded(uint256 indexed hackathonId, address verifier)",
  "event VerifierRemoved(uint256 indexed hackathonId, address verifier)"
];

// BuilderCreditScoring ABI
// Bug fix (Phase 3): pages/api/credit/score.js imports this symbol but it
// was never exported. Added a minimal read-only surface — the route is
// currently mocked, but having the ABI in place makes the wire-up trivial
// when the contract is live.
export const BUILDER_CREDIT_SCORING_ABI = [
  "function getCreditScore(address developer) external view returns (uint256)",
  "function getBreakdown(address developer) external view returns (uint256 profile, uint256 activity, uint256 community, uint256 repositories, uint256 consistency)",
  "function getTier(address developer) external view returns (string memory)",
  "function isVerified(address developer) external view returns (bool)"
];
