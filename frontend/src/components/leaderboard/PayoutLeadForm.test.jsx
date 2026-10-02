/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockTrackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args) => mockTrackEvent(...args),
}));

vi.mock('@/components/common/Input', () => ({
  Input: (props) => <input {...props} />,
}));

vi.mock('@/components/common/Button', () => ({
  default: ({ children, loading, disabled, ...props }) => (
    <button disabled={disabled || loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

vi.mock('@/components/common/Card', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
}));

import PayoutLeadForm from './PayoutLeadForm';

function fillInput(placeholder, value) {
  const el = screen.getByPlaceholderText(placeholder);
  fireEvent.change(el, { target: { value } });
}

describe('PayoutLeadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders the form with all fields', () => {
    render(<PayoutLeadForm />);
    expect(screen.getByText('Know a hackathon we\'re missing?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Hackathon name *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your email *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Prize amount (optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your wallet address (optional)')).toBeInTheDocument();
    expect(screen.getByText('Submit Payout Info')).toBeInTheDocument();
  });

  it('disables submit when required fields are empty', () => {
    render(<PayoutLeadForm />);
    const btn = screen.getByText('Submit Payout Info');
    expect(btn.closest('button')).toBeDisabled();
  });

  it('fires analytics and shows success on submit', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    render(<PayoutLeadForm />);

    fillInput('Hackathon name *', 'Test Hackathon');
    fillInput('Your email *', 'test@example.com');
    fillInput('Prize amount (optional)', '5000');
    fillInput('Your wallet address (optional)', '0x1234');

    fireEvent.click(screen.getByText('Submit Payout Info'));

    await waitFor(() => {
      expect(screen.getByText('Thanks for contributing!')).toBeInTheDocument();
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('payout_lead_submitted', {
      hackathon: 'Test Hackathon',
      has_prize: true,
      has_wallet: true,
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/payout-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hackathonName: 'Test Hackathon',
        email: 'test@example.com',
        prizeAmount: 5000,
        wallet: '0x1234',
        announcementUrl: null,
      }),
    });
  });

  it('shows error toast on failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<PayoutLeadForm />);

    fillInput('Hackathon name *', 'Test Hackathon');
    fillInput('Your email *', 'test@example.com');
    fireEvent.click(screen.getByText('Submit Payout Info'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows server error message on 4xx response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid email domain' }),
    });

    render(<PayoutLeadForm />);

    fillInput('Hackathon name *', 'Test');
    fillInput('Your email *', 'bad@example.com');
    fireEvent.click(screen.getByText('Submit Payout Info'));

    await waitFor(() => {
      expect(screen.getByText('Invalid email domain')).toBeInTheDocument();
    });
  });
});
