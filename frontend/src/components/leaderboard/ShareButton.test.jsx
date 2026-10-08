/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args) => trackEvent(...args),
}));

const getSharerCode = vi.fn(() => null);
vi.mock('@/lib/gamification/referral', () => ({
  getSharerCode: () => getSharerCode(),
}));

import ShareButton from './ShareButton';

describe('ShareButton', () => {
  let openSpy;
  let locationSpy;

  beforeEach(() => {
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    trackEvent.mockClear();
    getSharerCode.mockReturnValue(null);
    locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({ origin: 'https://test.app' });
  });

  afterEach(() => {
    openSpy.mockRestore();
    locationSpy.mockRestore();
  });

  it('renders X and Farcaster share buttons for a verified entry', () => {
    render(<ShareButton entry={{ name: 'alice', verifiedWins: 2 }} rank={1} entryType="builder" />);
    expect(screen.getByTitle('Share on X')).toBeInTheDocument();
    expect(screen.getByTitle('Share on Farcaster')).toBeInTheDocument();
  });

  it('renders nothing when the entry has no verified wins (guardrail)', () => {
    const { container } = render(<ShareButton entry={{ name: 'alice', verifiedWins: 0 }} rank={1} entryType="builder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a null entry', () => {
    const { container } = render(<ShareButton entry={null} rank={1} entryType="builder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders hackathon entries without verifiedWins (API trust gate)', () => {
    render(<ShareButton entry={{ name: 'ETHGlobal' }} rank={1} entryType="hackathon" />);
    expect(screen.getByTitle('Share on X')).toBeInTheDocument();
  });

  it('clicking the X button calls trackEvent with platform=x', () => {
    render(<ShareButton entry={{ name: 'alice', verifiedWins: 1 }} rank={1} entryType="builder" />);
    fireEvent.click(screen.getByTitle('Share on X'));
    expect(trackEvent).toHaveBeenCalledWith(
      'leaderboard_share_clicked',
      expect.objectContaining({ platform: 'x', entry_type: 'builder', rank: 1, entry_name: 'alice' })
    );
  });

  it('clicking the Farcaster button calls trackEvent with platform=farcaster', () => {
    render(<ShareButton entry={{ name: 'bob', verifiedWins: 1 }} rank={2} entryType="backer" />);
    fireEvent.click(screen.getByTitle('Share on Farcaster'));
    expect(trackEvent).toHaveBeenCalledWith(
      'leaderboard_share_clicked',
      expect.objectContaining({ platform: 'farcaster', entry_type: 'backer', rank: 2, entry_name: 'bob' })
    );
  });

  it('emits a share funnel_step event with the sharer code', () => {
    getSharerCode.mockReturnValue('ref_sharer1');
    render(<ShareButton entry={{ name: 'alice', verifiedWins: 1 }} rank={1} entryType="builder" />);
    fireEvent.click(screen.getByTitle('Share on X'));
    expect(trackEvent).toHaveBeenCalledWith(
      'funnel_step',
      expect.objectContaining({
        funnel: 'share',
        step: 'clicked',
        funnelId: 'ref_sharer1',
        platform: 'x',
        entryType: 'builder',
        rank: 1,
      })
    );
  });

  it('attributes anonymous shares to funnelId "anon"', () => {
    render(<ShareButton entry={{ name: 'alice', verifiedWins: 1 }} rank={1} entryType="builder" />);
    fireEvent.click(screen.getByTitle('Share on X'));
    expect(trackEvent).toHaveBeenCalledWith(
      'funnel_step',
      expect.objectContaining({ funnelId: 'anon' })
    );
  });

  it('uses the explicit `text` prop when provided', () => {
    render(<ShareButton text="custom text" entry={{ name: 'a', verifiedWins: 1 }} rank={1} entryType="builder" />);
    fireEvent.click(screen.getByTitle('Share on X'));
    const url = openSpy.mock.calls[0][0];
    expect(url).toContain('text=custom%20text');
  });

  it('falls back to generated share text for builders (entryType="builders")', () => {
    render(<ShareButton entry={{ name: 'alice', velocity: 99, verifiedWins: 4 }} rank={3} entryType="builders" />);
    fireEvent.click(screen.getByTitle('Share on X'));
    const url = openSpy.mock.calls[0][0];
    expect(url).toContain('twitter.com/intent/tweet');
    expect(url).toContain('alice');
  });

  it('builds a `?ref=` URL with entryType-rank when entryType and rank are provided', () => {
    render(<ShareButton text="t" entry={{ name: 'a', verifiedWins: 1 }} rank={5} entryType="project" />);
    fireEvent.click(screen.getByTitle('Share on X'));
    const url = openSpy.mock.calls[0][0];
    // The shareUrl is URL-encoded inside the twitter.com intent URL.
    expect(url).toContain(encodeURIComponent('ref=project-5'));
  });

  it('includes the sharer code and copy variant in the share URL', () => {
    getSharerCode.mockReturnValue('ref_sharer1');
    render(<ShareButton entry={{ name: 'alice', verifiedWins: 1 }} rank={1} entryType="builder" />);
    fireEvent.click(screen.getByTitle('Share on X'));
    const url = openSpy.mock.calls[0][0];
    expect(url).toContain(encodeURIComponent('s=ref_sharer1'));
    expect(url).toMatch(/v%3D\d/);
  });

  it('omits s= when the sharer is anonymous', () => {
    render(<ShareButton entry={{ name: 'alice', verifiedWins: 1 }} rank={1} entryType="builder" />);
    fireEvent.click(screen.getByTitle('Share on X'));
    const url = openSpy.mock.calls[0][0];
    expect(url).not.toContain('s%3D');
  });

  it('uses the explicit `url` prop when provided', () => {
    render(<ShareButton text="t" url="https://custom.example.com/x" entry={{ name: 'a', verifiedWins: 1 }} rank={1} entryType="builder" />);
    fireEvent.click(screen.getByTitle('Share on X'));
    const url = openSpy.mock.calls[0][0];
    expect(url).toContain('url=https%3A%2F%2Fcustom.example.com%2Fx');
  });

  it('Farcaster share strips @pledgebond from the text', () => {
    render(<ShareButton text="hello @pledgebond" entry={{ name: 'a', verifiedWins: 1 }} rank={1} entryType="builder" />);
    fireEvent.click(screen.getByTitle('Share on Farcaster'));
    const url = openSpy.mock.calls[0][0];
    expect(url).not.toContain('%40pledgebond');
    expect(url).toContain('hello');
  });
});
