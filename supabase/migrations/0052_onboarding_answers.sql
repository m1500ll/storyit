-- Sign-up onboarding (src/components/onboarding/WelcomeIntro.tsx): the customer's answers (goal, monthly target, time per
-- day, level, platforms), kept for the owner's dashboard and future e-mails. Written once by the customer.
alter table profiles add column if not exists onboarding jsonb;
grant update (onboarding) on profiles to authenticated;
