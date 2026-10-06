import { useState, useCallback } from 'react';

interface ScorePreviewResult {
  username: string;
  stats: {
    publicRepos: number;
    totalStars: number;
    followers: number;
    accountAgeDays: number;
  };
}

interface UseScorePreviewReturn {
  username: string;
  setUsername: (value: string) => void;
  result: ScorePreviewResult | null;
  error: string | null;
  loading: boolean;
  submit: (e?: React.FormEvent) => Promise<void>;
  reset: () => void;
}

export function useScorePreview(): UseScorePreviewReturn {
  const [username, setUsername] = useState('');
  const [result, setResult] = useState<ScorePreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/score/preview?username=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Could not fetch this builder’s track record');
        return;
      }
      setResult(data.data);
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [username]);

  const reset = useCallback(() => {
    setUsername('');
    setResult(null);
    setError(null);
  }, []);

  return { username, setUsername, result, error, loading, submit, reset };
}
