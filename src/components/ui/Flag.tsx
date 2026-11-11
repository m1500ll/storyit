/** Small rounded flag (SVG, no emoji) for the translation languages. */
export function Flag({ code, className = 'h-4 w-6' }: { code: 'fr' | 'en' | 'es' | string; className?: string }) {
  const common = { className: `${className} shrink-0 overflow-hidden rounded-[3px] shadow-sm ring-1 ring-black/10`, viewBox: '0 0 30 20', 'aria-hidden': true } as const;
  if (code === 'fr') return (
    <svg {...common}><rect width="10" height="20" fill="#0055A4" /><rect x="10" width="10" height="20" fill="#fff" /><rect x="20" width="10" height="20" fill="#EF4135" /></svg>
  );
  if (code === 'es') return (
    <svg {...common}><rect width="30" height="20" fill="#AA151B" /><rect y="5" width="30" height="10" fill="#F1BF00" /></svg>
  );
  return ( // English: Union Jack, simplified
    <svg {...common}>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#C8102E" strokeWidth="1.6" />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth="3.4" />
    </svg>
  );
}
