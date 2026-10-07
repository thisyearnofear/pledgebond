/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/common/Card', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/common/Button', () => ({
  default: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
}));

import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders the "builders" empty config by default', () => {
    render(<EmptyState tab="builders" />);
    expect(screen.getByText(/No builders yet/)).toBeInTheDocument();
    expect(screen.getByText(/Be the first to submit a project/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Submit a project/ })).toHaveAttribute('href', '/build');
  });

  it('renders the "proof-builders" config', () => {
    render(<EmptyState tab="proof-builders" />);
    expect(screen.getByText(/No proof builders yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add proof to a project/ })).toHaveAttribute('href', '/build');
  });

  it('renders the "projects" config with a different CTA', () => {
    render(<EmptyState tab="projects" />);
    expect(screen.getAllByText(/No proven projects yet/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Submit a proven project/ })).toHaveAttribute('href', '/build');
  });

  it('renders the "lenders" config pointing to /back', () => {
    render(<EmptyState tab="lenders" />);
    expect(screen.getByText(/No lenders yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fund a bridge loan/ })).toHaveAttribute('href', '/back');
  });

  it('renders the "hackathons" config', () => {
    render(<EmptyState tab="hackathons" />);
    expect(screen.getByText(/No hackathons yet/)).toBeInTheDocument();
  });

  it('falls back to the builders config for an unknown tab', () => {
    render(<EmptyState tab="unknown-tab" />);
    expect(screen.getByText(/No builders yet/)).toBeInTheDocument();
  });
});
