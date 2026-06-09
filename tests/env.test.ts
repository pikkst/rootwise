import { describe, expect, it } from 'vitest';
import { getRequiredEnvVar } from '../utils/env';

describe('getRequiredEnvVar', () => {
  it('returns existing environment values', () => {
    const result = getRequiredEnvVar({ VITE_SUPABASE_URL: 'https://example.supabase.co' }, 'VITE_SUPABASE_URL');
    expect(result).toBe('https://example.supabase.co');
  });

  it('throws when the requested environment key is missing', () => {
    expect(() => getRequiredEnvVar({ VITE_SUPABASE_URL: undefined }, 'VITE_SUPABASE_ANON_KEY')).toThrow(
      'Missing required environment variable: VITE_SUPABASE_ANON_KEY.'
    );
  });
});
