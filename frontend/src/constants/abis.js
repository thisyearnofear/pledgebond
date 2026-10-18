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
  "function declareWinner(uint256 hackathonId, address winner, string projectName, uint256 prizeAmount) external returns (uint256 declarationIndex)",
  "function recordPayout(uint256 hackathonId, uint256 declarationIndex, string payoutTxHash) external returns (bool finalized)",
  "function payoutAttested(uint256 hackathonId, uint256 declarationIndex, address verifier) external view returns (bool)",
  "function payoutAttestCount(uint256 hackathonId, uint256 declarationIndex) external view returns (uint256)",
  "function getWinnerDeclarations(uint256 hackathonId) external view returns ((address winner, string projectName, uint256 prizeAmount, uint256 declaredAt, uint256 paidAt, string payoutTxHash)[])",
  "function getDeclaration(uint256 hackathonId, uint256 index) external view returns (address winner, string projectName, uint256 prizeAmount, uint256 declaredAt, uint256 paidAt, string payoutTxHash)",
  "function getWinnerCount(uint256 hackathonId) external view returns (uint256)",
  "function getPayoutStats(uint256 hackathonId) external view returns (uint256 totalWinners, uint256 paidWinners, uint256 totalPrizeAmount, uint256 minPayoutLatency, uint256 maxPayoutLatency)",
  "event HackathonCreated(uint256 indexed hackathonId, string name, address host, uint8 requiredSignatures)",
  "event VerifierAdded(uint256 indexed hackathonId, address verifier)",
  "event VerifierRemoved(uint256 indexed hackathonId, address verifier)",
  "event WinnerDeclared(uint256 indexed hackathonId, address indexed winner, uint256 declarationIndex, string projectName, uint256 prizeAmount, uint256 declaredAt)",
  "event PayoutAttested(uint256 indexed hackathonId, uint256 indexed declarationIndex, address indexed verifier, string payoutTxHash)",
  "event PayoutRecorded(uint256 indexed hackathonId, address indexed winner, uint256 declarationIndex, string payoutTxHash, uint256 paidAt)"
];


// LiquidityRail ABI — bridge loans against confirmed wins, plus a payout
// market. Replaces BuilderCreditCore: no credit scores, no multipliers.
// Lifecycle: anchorWin → proposeLoan → commitTranche? → acceptLoan →
// repayLoan | defaultLoan. Markets resolve via resolveMarket/claimWinnings.
export const LIQUIDITY_RAIL_ABI = [
  "function anchorWin(uint256 hackathonId, uint256 declarationIndex) external returns (uint256)",
  "function proposeLoan(uint256 winId, uint256 principal, uint256 collateral, uint256 trancheSize, address trancheProvider, uint256 feeBps, uint256 durationDays, uint256 incentives) external returns (uint256)",
  "function commitTranche(uint256 proposalId) external",
  "function withdrawTranche(uint256 proposalId) external",
  "function cancelProposal(uint256 proposalId) external",
  "function acceptLoan(uint256 proposalId) external",
  "function repayLoan(uint256 winId) external",
  "function defaultLoan(uint256 winId) external",
  "function placeBet(uint256 winId, uint256 amount, bool expectsPayment) external",
  "function resolveMarket(uint256 winId) external",
  "function claimWinnings(uint256 winId) external",
  "function withdrawFees(address to, uint256 amount) external",
  "function wins(uint256 winId) external view returns (uint256 hackathonId, uint256 declarationIndex, address builder, uint256 prizeAmount, uint256 declaredAt, uint256 resolutionDeadline)",
  "function loans(uint256 winId) external view returns (uint256 winId, uint256 proposalId, address lender, address builder, address trancheProvider, uint256 principal, uint256 collateral, uint256 trancheSize, uint256 originationFee, uint256 dueAt, uint8 mode, uint8 status, uint256 incentives)",
  "function proposals(uint256 proposalId) external view returns (uint256 winId, address lender, uint256 principal, uint256 collateral, uint256 trancheSize, address trancheProvider, bool trancheCommitted, uint256 feeBps, uint256 durationDays, uint256 incentives, uint8 status)",
  "function markets(uint256 winId) external view returns (uint256 paidPool, uint256 unpaidPool, uint8 outcome, uint256 resolvedAt)",
  "function paidStakes(uint256 winId, address bettor) external view returns (uint256)",
  "function unpaidStakes(uint256 winId, address bettor) external view returns (uint256)",
  "function declarationWin(uint256 hackathonId, uint256 declarationIndex) external view returns (uint256)",
  "function builderHistory(address builder) external view returns (uint256 winsAnchored, uint256 winsPaid, uint256 winsUnpaid, uint256 loansTaken, uint256 loansRepaid, uint256 loansDefaulted, uint256 totalDaysToPay, uint256 fastestDaysToPay)",
  "function builderWins(address builder) external view returns (uint256[])",
  "function winCount() external view returns (uint256)",
  "function proposalCount() external view returns (uint256)",
  "function payoutRateBps(address builder) external view returns (uint256)",
  "function repaymentRateBps(address builder) external view returns (uint256)",
  "function averageDaysToPay(address builder) external view returns (uint256)",
  "function maxLoanSize() external view returns (uint256)",
  "function maxFeeBps() external view returns (uint256)",
  "function maxLoanDuration() external view returns (uint256)",
  "function marketResolutionWindow() external view returns (uint256)",
  "function totalLoanPrincipal() external view returns (uint256)",
  "function totalCollateral() external view returns (uint256)",
  "function totalTrancheCapacity() external view returns (uint256)",
  "function totalBetStakes() external view returns (uint256)",
  "function outstandingBetStakes() external view returns (uint256)",
  "function totalBetOwed() external view returns (uint256)",
  "function accruedFees() external view returns (uint256)",
  "function usdcToken() external view returns (address)",
  "function registry() external view returns (address)",
  "function FEE_ROLE() external view returns (bytes32)",
  "event WinAnchored(uint256 indexed winId, uint256 indexed hackathonId, uint256 declarationIndex, address indexed builder, string projectName, uint256 prizeAmount, uint256 declaredAt)",
  "event LoanProposed(uint256 indexed proposalId, uint256 indexed winId, address indexed lender, uint256 principal, uint256 collateral, uint256 trancheSize, address trancheProvider, uint256 feeBps, uint256 durationDays, uint256 incentives)",
  "event LoanFunded(uint256 indexed proposalId, uint256 indexed winId, address indexed lender, address builder, uint256 principal, uint256 originationFee, uint256 collateral, uint256 trancheSize, uint256 dueAt, uint8 mode)",
  "event LoanRepaid(uint256 indexed winId, address indexed lender, address indexed builder, uint256 principal)",
  "event LoanDefaulted(uint256 indexed winId, address indexed builder, uint256 principal, uint256 collateralToLender, uint256 trancheToLender)",
  "event CollateralReleased(uint256 indexed winId, address indexed builder, uint256 amount)",
  "event TrancheCommitted(uint256 indexed proposalId, address indexed provider, uint256 amount)",
  "event BetPlaced(uint256 indexed winId, address indexed bettor, uint256 amount, bool expectsPayment)",
  "event MarketResolved(uint256 indexed winId, uint8 outcome, uint256 paidPool, uint256 unpaidPool)",
  "event WinningsClaimed(uint256 indexed winId, address indexed bettor, uint256 stake, uint256 payout)",
  "event FeesWithdrawn(address indexed to, uint256 amount)"
];
