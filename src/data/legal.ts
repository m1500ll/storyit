/**
 * Legal identity shown on the Privacy Policy. Fill the TODO values before going public —
 * GDPR requires the real name and contact of the data controller.
 */
export const LEGAL = {
  product: 'Storyit',
  controller: 'ETO Core - F.Z.E',
  address: 'Office C1 - 1F - SF20258, Ajman Free Zone C1 Building, Ajman, United Arab Emirates',
  contactEmail: 'etook0.pro@gmail.com',
  supervisoryAuthority: { name: 'CNIL', url: 'https://www.cnil.fr' },
  lastUpdated: '2026-11-19',
  website: 'https://storyit.fun',
  /** Set to true once the Gemini API key is on a paid (billing-enabled) Google project. */
  geminiPaidTier: false,
};

export const isTodo = (v: string) => v.startsWith('TODO');
