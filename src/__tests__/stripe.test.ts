import { describe, expect, it } from 'vitest';
import { TRIAL, invoicePriceId, planForSubscription, planLine, productForPrice, verifySignature } from '@shared/stripe.ts';

const env = (k: string) => ({ STRIPE_PRICE_CREATOR: 'price_c', STRIPE_PRICE_PRO: 'price_pro', STRIPE_PRICE_STUDIO: 'price_s', STRIPE_PRICE_PACK_100: 'price_p1', STRIPE_PRICE_PACK_500: 'price_p5' } as Record<string, string>)[k];

async function sign(payload: string, secret: string, t: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  return `t=${t},v1=${Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

describe('Stripe webhook helpers', () => {
  it('accepts a valid signature and rejects tampered, old or missing ones', async () => {
    const t = 1_800_000_000;
    const h = await sign('{"a":1}', 'whsec_x', t);
    expect(await verifySignature('{"a":1}', h, 'whsec_x', t)).toBe(true);
    expect(await verifySignature('{"a":2}', h, 'whsec_x', t)).toBe(false);
    expect(await verifySignature('{"a":1}', h, 'whsec_other', t)).toBe(false);
    expect(await verifySignature('{"a":1}', h, 'whsec_x', t + 301)).toBe(false);
    expect(await verifySignature('{"a":1}', null, 'whsec_x', t)).toBe(false);
  });
  it('maps prices to products from server config only', () => {
    expect(productForPrice('price_s', env)).toBe('studio');
    expect(productForPrice('price_pro', env)).toBe('pro');
    expect(planForSubscription({ status: 'active', items: { data: [{ price: { id: 'price_pro' } }] } }, env)).toBe('pro');
    expect(productForPrice('price_unknown', env)).toBeNull();
  });
  it('reads the paid price on old and new invoice shapes', () => {
    expect(invoicePriceId({ lines: { data: [{ price: { id: 'price_c' } }] } })).toBe('price_c');
    expect(invoicePriceId({ lines: { data: [{ pricing: { price_details: { price: 'price_s' } } }] } })).toBe('price_s');
  });
  it('plan follows the subscription: upgrade, cancellation, unpaid', () => {
    const sub = (status: string, price: string) => ({ status, items: { data: [{ price: { id: price } }] } });
    expect(planForSubscription(sub('active', 'price_s'), env)).toBe('studio');
    expect(planForSubscription(sub('unpaid', 'price_s'), env)).toBe('free');
    expect(planForSubscription(sub('canceled', 'price_c'), env)).toBe('free');
    expect(planForSubscription(sub('incomplete', 'price_c'), env)).toBeNull();
  });
});

describe('planLine (trial vs paid invoices)', () => {
  const env = (k: string) => ({ STRIPE_PRICE_CREATOR: 'price_creator', STRIPE_PRICE_STUDIO: 'price_studio' } as Record<string, string>)[k];
  it('finds the plan line and its amount on a normal invoice', () => {
    expect(planLine({ lines: { data: [{ price: { id: 'price_creator' }, amount: 2900 }] } }, env)).toEqual({ product: 'creator', amount: 2900 });
  });
  it('sees a $1 trial invoice: plan line at 0 even when the one-time fee comes first', () => {
    const inv = { lines: { data: [{ price: { id: 'price_trial_fee' }, amount: 100 }, { pricing: { price_details: { price: 'price_studio' } }, amount: 0 }] } };
    expect(planLine(inv, env)).toEqual({ product: 'studio', amount: 0 });
  });
  it('returns null for a credit pack invoice', () => {
    expect(planLine({ lines: { data: [{ price: { id: 'price_pack' }, amount: 1200 }] } }, env)).toBeNull();
  });
  it('trial settings: $1 for 3 days, 7000 credits, switch to the plan below 1000 left', () => {
    expect(TRIAL).toEqual({ feeCents: 100, days: 3, credits: 7000, switchAt: 1000 });
  });
});
