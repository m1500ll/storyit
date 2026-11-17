import { describe, expect, it } from 'vitest';
import { clipAccess } from './clipAccess';

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

describe('clipAccess', () => {
  it('refuses free accounts', () => expect(clipAccess({ plan: 'free' }, 0)).toBe('subscription_required'));
  it('lets the $1 trial make one video', () => {
    expect(clipAccess({ plan: 'creator', trial_ends_at: future }, 0)).toBe('ok');
    expect(clipAccess({ plan: 'creator', trial_ends_at: future }, 1)).toBe('trial_limit');
  });
  it('lets subscribers make as many as they want', () => {
    expect(clipAccess({ plan: 'creator', trial_ends_at: past }, 5)).toBe('ok');
    expect(clipAccess({ plan: 'studio', trial_ends_at: null }, 9)).toBe('ok');
  });
  it('never blocks admins', () => expect(clipAccess({ plan: 'free', is_admin: true }, 3)).toBe('ok'));
});
