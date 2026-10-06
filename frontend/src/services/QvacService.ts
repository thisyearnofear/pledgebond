/**
 * QVAC Local-First AI Service
 *
 * Integrates Tether's QVAC SDK for privacy-preserving inference.
 * QVAC runs AI models locally on the user's machine — data never leaves the device.
 *
 * ## Architecture
 *
 * QVAC does NOT run in browsers. It requires the Bare runtime or native GPU
 * backends (Vulkan/Metal). The integration supports two modes:
 *
 * 1. **HTTP server mode** (primary): User runs `qvac serve` locally, exposing
 *    an OpenAI-compatible API at localhost:PORT. The browser calls this endpoint
 *    instead of cloud APIs. Model runs on user's GPU, project data stays local.
 *
 * 2. **Direct SDK mode** (server-side): When running in a Node.js/Bare process
 *    (not serverless), the SDK can load models directly via `loadModel()` and
 *    call `completion()`. Useful for self-hosted deployments with GPU access.
 *
 * ## Provider chain
 *
 *   QVAC local (localhost) → Featherless cloud → AIsa cloud → Rule-based fallback
 *
 * Each layer uses the same prompts and returns the same structure, so the UI
 * doesn't care which provider served the result.
 *
 * ## Installation
 *
 *   npm install -g @qvac/sdk
 *   qvac serve  # starts OpenAI-compatible server on localhost:3000
 *
 * Tracks: Tether Frontier Track ($10K)
 * @see https://docs.qvac.tether.io
 */

export interface QvacCompletionRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface QvacCompletionResult {
  text: string;
  source: 'qvac-local' | 'cloud-fallback';
  modelId?: string;
}

export interface QvacStatus {
  available: boolean;
  modelLoaded: boolean;
  modelId: string | null;
  error?: string;
}

// Default local server URL — matches `qvac serve` default
const QVAC_LOCAL_URL = 'http://localhost:3000';

// Model identifier used in the OpenAI-compatible API
const QVAC_MODEL = 'llm';

// Cache the local server status to avoid repeated checks
let localServerAvailable: boolean | null = null;
let lastCheckTime = 0;
const CHECK_COOLDOWN_MS = 10_000; // Re-check every 10s if unavailable

class QvacService {
  private localUrl: string;

  constructor() {
    this.localUrl = typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_QVAC_URL || QVAC_LOCAL_URL)
      : (process.env.QVAC_URL || QVAC_LOCAL_URL);
  }

  /**
   * Check if a local QVAC server is running and responsive.
   * Tries the OpenAI-compatible /v1/models endpoint.
   */
  async getStatus(): Promise<QvacStatus> {
    const now = Date.now();

    // Use cached status if recent
    if (localServerAvailable !== null && now - lastCheckTime < CHECK_COOLDOWN_MS) {
      return {
        available: localServerAvailable,
        modelLoaded: localServerAvailable,
        modelId: localServerAvailable ? QVAC_MODEL : null,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${this.localUrl}/v1/models`, {
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timeout);

      localServerAvailable = res.ok;
      lastCheckTime = now;

      return {
        available: res.ok,
        modelLoaded: res.ok,
        modelId: res.ok ? QVAC_MODEL : null,
      };
    } catch {
      localServerAvailable = false;
      lastCheckTime = now;
      return {
        available: false,
        modelLoaded: false,
        modelId: null,
        error: 'QVAC local server not running',
      };
    }
  }

  /**
   * Force a fresh status check (ignores cache).
   */
  async refreshStatus(): Promise<QvacStatus> {
    localServerAvailable = null;
    lastCheckTime = 0;
    return this.getStatus();
  }

  /**
   * Generate a completion via the local QVAC server.
   * Uses the OpenAI-compatible /v1/chat/completions endpoint.
   */
  async complete(request: QvacCompletionRequest): Promise<QvacCompletionResult> {
    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const res = await fetch(`${this.localUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      body: JSON.stringify({
        model: QVAC_MODEL,
        messages,
        max_tokens: request.maxTokens || 1024,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      throw new Error(`QVAC server returned ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';

    return {
      text,
      source: 'qvac-local',
      modelId: data.model || QVAC_MODEL,
    };
  }

  /**
   * Analyze a project via local QVAC inference.
   * Project data stays on the user's machine.
   */
  async analyzeProject(projectData: {
    name: string;
    description: string;
    githubUrl?: string;
    ecosystem?: string;
  }): Promise<QvacCompletionResult> {
    const prompt = `Analyze this project and return a JSON score object:
{
  "score": <0-100>,
  "strengths": [<string>, ...],
  "risks": [<string>, ...],
  "recommendation": "<one of: strong-back, moderate-back, watch, skip>",
  "summary": "<one sentence>"
}

Project: ${projectData.name}
Description: ${projectData.description}
${projectData.githubUrl ? `GitHub: ${projectData.githubUrl}` : ''}
${projectData.ecosystem ? `Ecosystem: ${projectData.ecosystem}` : ''}`;

    return this.complete({
      prompt,
      systemPrompt: 'You are an expert project analyst for a Solana hackathon platform. Respond only with valid JSON.',
    });
  }

  /**
   * Check if QVAC is available and throw if not.
   * Convenience method for callers that want a simple gate.
   */
  async ensureAvailable(): Promise<void> {
    const status = await this.getStatus();
    if (!status.available) {
      throw new Error('QVAC local server not running. Start it with: qvac serve');
    }
  }
}

export const qvacService = new QvacService();
export default qvacService;
