// Supabase Edge Function: `stripe-webhook`
// Grants Story Credits when Stripe confirms a payment. Deploy with "Verify JWT" DISABLED
// (Stripe cannot send a Supabase JWT; authenticity is checked with the Stripe signature instead).
// Secrets: STRIPE_WEBHOOK_SECRET (whsec_...), plus the STRIPE_PRICE_* used by `billing`.
// Stripe events to send: checkout.session.completed, invoice.paid, customer.subscription.deleted
import { createClient } from 'npm:@supabase/supabase-js@2';

/** Credits granted per product. Keep in sync with src/services/credits.ts (PLANS / CREDIT_PACKS). */
const GRANTS: Record<string, { credits: number; plan?: 'creator' | 'studio'; label: string }> = {
  creator: { credits: 300, plan: 'creator', label: 'Creator plan — monthly credits' },
  studio: { credits: 1200, plan: 'studio', label: 'Studio plan — monthly credits' },
  pack_100: { credits: 100, label: 'Top-up pack — 100 credits' },
  pack_500: { credits: 500, label: 'Top-up pack — 500 credits' },
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** Verifies the `Stripe-Signature` header (HMAC-SHA256, 5-minute tolerance). */
async function verifySignature(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const timestamp = parts.t;
  const signatures = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
}
function timingSafeEqual(a: string, b: string) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function userIdForCustomer(customerId: string | null | undefined) {
  if (!customerId) return null;
  const { data } = await admin.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function grant(userId: string, product: string, reset: boolean) {
  const g = GRANTS[product];
  if (!g) throw new Error(`Unknown product ${product}`);
  const { error } = await admin.rpc('grant_credits', {
    p_user_id: userId, p_amount: g.credits, p_type: g.plan ? 'subscription_grant' : 'purchase',
    p_description: g.label, p_plan: g.plan ?? null, p_reset: reset,
  });
  if (error) throw new Error(error.message);
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret || !(await verifySignature(payload, req.headers.get('stripe-signature'), secret))) {
    return new Response('Invalid signature', { status: 400 });
  }
  const event = JSON.parse(payload);

  // Idempotency: Stripe retries; apply each event once.
  const { error: dup } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dup) return new Response('Already processed', { status: 200 });

  try {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed': {
        // One-off packs only; subscriptions are granted on invoice.paid (covers first month + renewals).
        if (obj.mode === 'payment' && obj.payment_status === 'paid') {
          const userId = obj.metadata?.user_id ?? obj.client_reference_id;
          if (userId) await grant(userId, obj.metadata?.product, false);
        }
        break;
      }
      case 'invoice.paid': {
        const meta = obj.parent?.subscription_details?.metadata ?? obj.subscription_details?.metadata ?? {};
        const userId = meta.user_id ?? (await userIdForCustomer(obj.customer));
        if (userId && meta.product) await grant(userId, meta.product, true);
        break;
      }
      case 'customer.subscription.deleted': {
        const userId = obj.metadata?.user_id ?? (await userIdForCustomer(obj.customer));
        if (userId) await admin.from('profiles').update({ plan: 'free' }).eq('id', userId);
        break;
      }
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    // Let Stripe retry: forget the event so the retry is processed.
    await admin.from('stripe_events').delete().eq('id', event.id);
    return new Response('Handler error', { status: 500 });
  }
});
