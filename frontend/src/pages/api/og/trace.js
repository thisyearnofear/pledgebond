/**
 * OG Image for Scout Trace Pages
 *
 * Generates a shareable OpenGraph image for /scout/trace/{runId}
 * URL: /api/og/trace?runId={id}&project={name}&score={number}&trace={text}
 */

import { ImageResponse } from 'next/og';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId') || 'unknown';
  const project = searchParams.get('project') || 'Unknown Project';
  const score = searchParams.get('score') || '?';
  const trace = searchParams.get('trace') || 'AI reasoning trace for this project evaluation.';

  const truncatedTrace = trace.length > 140 ? trace.slice(0, 140) + '...' : trace;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
          padding: '48px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
          }} />
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#06b6d4', letterSpacing: '2px' }}>
            PROOF SCOUT
          </span>
          <span style={{ fontSize: '14px', color: '#64748b', marginLeft: '8px' }}>
            Autonomous On-chain Agent
          </span>
        </div>

        {/* Project & Score */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            fontSize: '42px',
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: '8px',
            lineHeight: 1.2,
          }}>
            {project}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '20px',
              color: '#f59e0b',
              fontWeight: 'bold',
            }}>
              Score: {score}/100
            </span>
            <span style={{
              fontSize: '14px',
              color: '#64748b',
              fontFamily: 'monospace',
            }}>
              {runId}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          height: '1px',
          backgroundColor: '#1e293b',
          marginBottom: '24px',
        }} />

        {/* Reasoning Trace */}
        <div style={{
          fontSize: '22px',
          color: '#cbd5e1',
          lineHeight: 1.5,
          flex: 1,
        }}>
          &ldquo;{truncatedTrace}&rdquo;
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto',
          paddingTop: '24px',
          borderTop: '1px solid #1e293b',
        }}>
          <span style={{ fontSize: '14px', color: '#64748b' }}>
            Transparent AI reasoning traces on-chain
          </span>
          <span style={{ fontSize: '14px', color: '#06b6d4', fontWeight: 'bold' }}>
            pledgebond.com/scout
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
