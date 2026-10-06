/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/badges/computeBadges', () => ({
  computeLeaderboardBadges: () => [],
}));

vi.mock('@/components/common/ProofBadge', () => ({
  ProofBadgeGroup: () => null,
}));

import LeaderboardRow from './LeaderboardRow';

describe('LeaderboardRow', () => {
  it('renders the builder name and explorer link for builders', () => {
    const entry = { name: 'alice', address: '9aE4abcdefghijklmnop', velocity: 99, projectCount: 5, milestoneCount: 12 };
    render(<LeaderboardRow entry={entry} rank={1} type="builders" />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('5 projects · 12 milestones')).toBeInTheDocument();
    expect(screen.getByText('shipping velocity')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('renders the backer-specific copy for backers', () => {
    const entry = { name: 'bob', address: '0xabc', totalBacked: 1234, projectsBacked: 7, score: 88 };
    render(<LeaderboardRow entry={entry} rank={2} type="backers" />);
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('$1,234 funded · 7 projects')).toBeInTheDocument();
    expect(screen.getByText('backing score')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
  });

  it('falls back to truncated address when name is missing', () => {
    const entry = { address: '0xabcdef1234567890', velocity: 10 };
    render(<LeaderboardRow entry={entry} rank={3} type="builders" />);
    expect(screen.getByText('0xab...7890')).toBeInTheDocument();
  });

  it('uses 🥇 for rank 1', () => {
    const entry = { name: 'a', velocity: 5 };
    const { container } = render(<LeaderboardRow entry={entry} rank={1} type="builders" />);
    expect(container.textContent).toContain('🥇');
  });

  it('uses #N for ranks > 3', () => {
    const entry = { name: 'a', velocity: 5 };
    const { container } = render(<LeaderboardRow entry={entry} rank={10} type="builders" />);
    expect(container.textContent).toContain('#10');
  });

  it('renders the Torque badge when source is torque', () => {
    const entry = { name: 'a', velocity: 5, source: 'torque' };
    render(<LeaderboardRow entry={entry} rank={1} type="builders" />);
    expect(screen.getByText('Torque')).toBeInTheDocument();
  });

  it('does not render the explorer link when address is missing', () => {
    const entry = { name: 'a', velocity: 5 };
    const { container } = render(<LeaderboardRow entry={entry} rank={1} type="builders" />);
    expect(container.querySelector('a[href*="explorer.solana.com"]')).toBeNull();
  });

  it('renders the SNS domain badge when present', () => {
    const entry = { name: 'a', velocity: 5, snsDomain: 'alice.sol' };
    render(<LeaderboardRow entry={entry} rank={1} type="builders" />);
    expect(screen.getByText('alice.sol')).toBeInTheDocument();
  });
});
