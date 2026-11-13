/**
 * Legal identity shown on the Privacy Policy. Fill the TODO values before going public —
 * GDPR requires the real name and contact of the data controller.
 */
export const LEGAL = {
  product: 'Storyit',
  controller: 'Hamza Boudouaia',
  address: 'Four Tower, Business Bay, Dubai, United Arab Emirates',
  contactEmail: 'support@storyit.fun',
  supervisoryAuthority: { name: 'CNIL', url: 'https://www.cnil.fr' },
  lastUpdated: '2026-11-13',
  website: 'https://storyit.fun',
  /** Set to true once the Gemini API key is on a paid (billing-enabled) Google project. */
  geminiPaidTier: false,
};

export const isTodo = (v: string) => v.startsWith('TODO');
