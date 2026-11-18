import { describe, expect, it } from 'vitest';
import { planFor } from './WelcomeIntro';

describe('onboarding plan', () => {
  it('recommends the smallest plan that covers the pace', () => {
    expect(planFor({ time: '15' }).plan.id).toBe('creator');
    expect(planFor({ time: '30' }).plan.id).toBe('pro');
    expect(planFor({ time: '60' }).plan.id).toBe('studio');
  });
  it('never announces more videos than the plan pays for, except the top pace (top-ups)', () => {
    for (const t of ['15', '30', '60']) { const p = planFor({ time: t }); expect(p.perMonth).toBeLessThanOrEqual(p.plan.videos); }
  });
  it('labels the profile from the answers', () => {
    expect(planFor({ goal: 'business' }).profile).toBe('Créateur ambitieux');
    expect(planFor({ level: 'zero' }).profile).toBe('Nouveau créateur motivé');
  });
});
