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

// HackathonRegistry ABI
// declareWinner/recordPayout are the credibility anchor: the declaredAt/paidAt
// pair makes a win underwritable and a builder's payment history public.
export const HACKATHON_REGISTRY_ABI = [
  "function isVerifier(uint256 hackathonId, address account) external view returns (bool)",
  "function hackathonExists(uint256 hackathonId) external view returns (bool)",
  "function getRequiredSignatures(uint256 hackathonId) external view returns (uint256)",
  "function getHackathonVerifiers(uint256 hackathonId) external view returns (address[])",
  "function getHackathonIdByName(string name) external view returns (uint256)",
  "function getHackathonDetails(uint256 hackathonId) external view returns (string name, address organizer, uint256 startDate, uint256 endDate, bool active)",
  "function hackathons(uint256 hackathonId) public view returns (address host, uint8 requiredSignatures, bool active, uint256 startDate, uint256 endDate, uint256 createdAt, string name)",
  "function declareWinner(uint256 hackathonId, address winner, string projectName, uint256 prizeAmount) external",
  "function recordPayout(uint256 hackathonId, address winner, string payoutTxHash) external",
  "function getWinnerDeclarations(uint256 hackathonId) external view returns ((address winner, string projectName, uint256 prizeAmount, uint256 declaredAt, uint256 paidAt, string payoutTxHash)[])",
  "function getWinnerCount(uint256 hackathonId) external view returns (uint256)",
  "function getPayoutStats(uint256 hackathonId) external view returns (uint256 totalWinners, uint256 paidWinners, uint256 totalPrizeAmount, uint256 minPayoutLatency, uint256 maxPayoutLatency)",
  "event HackathonCreated(uint256 indexed hackathonId, string name, address host, uint8 requiredSignatures)",
  "event VerifierAdded(uint256 indexed hackathonId, address verifier)",
  "event VerifierRemoved(uint256 indexed hackathonId, address verifier)",
  "event WinnerDeclared(uint256 indexed hackathonId, address indexed winner, string projectName, uint256 prizeAmount, uint256 declaredAt)",
  "event PayoutRecorded(uint256 indexed hackathonId, address indexed winner, string payoutTxHash, uint256 paidAt)"
];


// LiquidityRail ABI — bridge loans against confirmed wins, plus a payout
// market. Replaces BuilderCreditCore: no credit scores, no multipliers.
export const LIQUIDITY_RAIL_ABI = [
  "function declareWin(uint256 hackathonId, address builder, string projectName, uint256 prizeAmount) external returns (uint256)",
  "function openLoan(uint256 winId, uint256 principal, uint256 collateral, uint256 trancheSize, address trancheProvider, uint256 rateBps, uint256 durationDays, uint256 incentives) external",
  "function settleLoan(uint256 winId) external",
  "function defaultLoan(uint256 winId) external",
  "function releaseTranche(uint256 winId) external",
  "function withdrawFees(address to, uint256 amount) external",
  "function wins(uint256 winId) external view returns (uint256 hackathonId, address builder, uint256 prizeAmount, uint256 declaredAt, uint256 settledAt, uint8 status)",
  "function loans(uint256 winId) external view returns (uint256 winId, address lender, address builder, address trancheProvider, uint256 principal, uint256 collateral, uint256 trancheSize, uint256 originationFee, uint256 dueAt, uint8 mode, uint8 status, uint256 incentives)",
  "function bets(uint256 winId, uint256 index) external view returns (address bettor, uint256 amount, bool expectsPayment, bool claimed)",
  "function builderHistory(address builder) external view returns (uint256 winsDeclared, uint256 loansTaken, uint256 loansRepaid, uint256 winsSettledInFull, uint256 winsDefaulted, uint256 totalDaysToPay, uint256 fastestDaysToPay)",
  "function coverageRateBps(address builder) external view returns (uint256)",
  "function averageDaysToPay(address builder) external view returns (uint256)",
  "function maxLoanSize() external view returns (uint256)",
  "function maxRateBps() external view returns (uint256)",
  "function maxLoanDuration() external view returns (uint256)",
  "function totalLoanPrincipal() external view returns (uint256)",
  "function totalCollateral() external view returns (uint256)",
  "function totalBetStakes() external view returns (uint256)",
  "function accruedFees() external view returns (uint256)",
  "function usdcToken() external view returns (address)",
  "function registry() external view returns (address)",
  "function FEE_ROLE() external view returns (bytes32)",
  "event WinDeclared(uint256 indexed winId, uint256 indexed hackathonId, address indexed builder, string projectName, uint256 prizeAmount, uint256 declaredAt)",
  "event LoanOpened(uint256 indexed winId, address indexed lender, uint256 principal, uint256 collateral, uint256 trancheSize, uint256 originationFee, uint256 dueAt, uint8 mode)",
  "event LoanRepaid(uint256 indexed winId, address indexed lender, uint256 principal)",
  "event LoanDefaulted(uint256 indexed winId, address indexed builder, uint256 principal, uint256 collateralLiquidated, uint256 trancheAbsorbed)",
  "event CollateralReleased(uint256 indexed winId, address indexed builder, uint256 amount)",
  "event WinSettled(uint256 indexed winId, address indexed builder, uint256 daysToPay)",
  "event FeesWithdrawn(address indexed to, uint256 amount)"
];
