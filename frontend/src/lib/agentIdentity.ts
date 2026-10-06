/**
 * Agent Identity — SNS-based identities for PledgeBond AI agents.
 *
 * Each agent (Scout, Underwriter, Verifier, Portfolio Manager) has a .sol domain
 * identity that provides human-readable on-chain identity, satisfying the SNS
 * Identity Track requirement for "AI agents with distinct on-chain identities."
 *
 * Tracks: Superteam SNS Identity Track
 */

export const AGENT_IDENTITIES = {
  scout: {
    domain: 'pledgebond-scout.sol',
    displayName: 'Scout Agent',
    description: 'Scans projects and flags bridge-loan candidates',
    icon: '🔭',
  },
  underwrite: {
    domain: 'pledgebond-underwriter.sol',
    displayName: 'Underwriter Agent',
    description: 'Analyzes project health and payout-track-record signals',
    icon: '🤖',
  },
  verify: {
    domain: 'pledgebond-verifier.sol',
    displayName: 'Verifier Agent',
    description: 'Reviews and verifies milestone PR code',
    icon: '✅',
  },
  rebalance: {
    domain: 'pledgebond-rebalance.sol',
    displayName: 'Rebalance Agent',
    description: 'Manages portfolio allocation across hackathon groups',
    icon: '⚖️',
  },
} as const;

export type AgentType = keyof typeof AGENT_IDENTITIES;

/**
 * Get the identity metadata for a given agent type.
 */
export function getAgentIdentity(agentType: string) {
  return AGENT_IDENTITIES[agentType as AgentType] || {
    domain: `${agentType}.agent.sol`,
    displayName: `${agentType} Agent`,
    description: 'AI agent',
    icon: '🤖',
  };
}

/**
 * Build a standardized agent identity block for API responses.
 * Include this in any agent endpoint response so the frontend can
 * display the agent's .sol identity.
 */
export function agentIdentityResponse(agentType: string) {
  const identity = getAgentIdentity(agentType);
  return {
    agent: {
      type: agentType,
      snsDomain: identity.domain,
      displayName: identity.domain,
      humanName: identity.displayName,
      icon: identity.icon,
      description: identity.description,
    },
  };
}
