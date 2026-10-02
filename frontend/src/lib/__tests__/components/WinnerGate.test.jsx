/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/stores/authStore', () => ({
  useUser: () => ({ currentUser: null }),
}));

const trackFunnelStepMock = vi.fn();
vi.mock('@/lib/funnel', () => ({
  trackFunnelStep: (...args) => trackFunnelStepMock(...args),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, className }) => (
    <a href={href} onClick={onClick} className={className}>{children}</a>
  ),
}));

vi.mock('@/components/common/Card', () => ({
  Card: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/components/common/Button', () => ({
  default: ({ children, onClick, type, disabled }) => (
    <button onClick={onClick} type={type} disabled={disabled}>{children}</button>
  ),
}));

vi.mock('@/components/common/Input', () => ({
  Input: () => <input />,
  Textarea: () => <textarea />,
  Select: ({ children }) => <select>{children}</select>,
  Checkbox: () => <input type="checkbox" />,
}));

vi.mock('@/components/common/LoadingStates', () => ({
  LoadingSpinner: () => <div data-testid="spinner" />,
}));

import WinnerGate from '../../../components/projects/WinnerGate';

describe('WinnerGate', () => {
  beforeEach(() => {
    trackFunnelStepMock.mockClear();
  });

  it('shows the claim form with a next action to explore hackathons when there is no win yet', () => {
    render(<WinnerGate onSubmitClaim={() => {}} loading={false} pendingClaim={null} error={null} />);

    expect(screen.getByText(/Past Hackathon Winners/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /active and upcoming hackathons/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/explore?tab=hackathons');
  });

  it('tracks a funnel step when the winless builder clicks through to hackathons', () => {
    render(<WinnerGate onSubmitClaim={() => {}} loading={false} pendingClaim={null} error={null} />);

    fireEvent.click(screen.getByRole('link', { name: /active and upcoming hackathons/i }));

    expect(trackFunnelStepMock).toHaveBeenCalledWith('winner_claim', 'explore_hackathons_clicked');
  });

  it('shows the pending state instead of the explore link when a claim is pending', () => {
    render(
      <WinnerGate
        onSubmitClaim={() => {}}
        loading={false}
        pendingClaim={{ id: 'claim-1', hackathonName: 'TestHack 2026' }}
        error={null}
      />
    );

    expect(screen.getByText(/in the Queue/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /active and upcoming hackathons/i })).toBeNull();
  });
});
