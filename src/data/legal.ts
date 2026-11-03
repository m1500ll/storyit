/**
 * Legal identity shown on the Privacy Policy. Fill the TODO values before going public —
 * GDPR requires the real name and contact of the data controller.
 */
export const LEGAL = {
  product: 'Storyit.io',
  controller: 'TODO: legal name of the company or individual running Storyit',
  address: 'TODO: postal address',
  contactEmail: 'TODO: privacy contact email (e.g. privacy@storyit.io)',
  supervisoryAuthority: { name: 'CNIL', url: 'https://www.cnil.fr' },
  lastUpdated: '2026-11-03',
  /** Set to true once the Gemini API key is on a paid (billing-enabled) Google project. */
  geminiPaidTier: false,
};

export const isTodo = (v: string) => v.startsWith('TODO');
