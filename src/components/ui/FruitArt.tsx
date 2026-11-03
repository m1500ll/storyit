import { cn } from '@/lib/cn';

type Fruit = 'strawberry' | 'lemon' | 'lime' | 'kiwi' | 'banana' | 'grape' | 'generic';

const PALETTE: Record<Fruit, { body: string; shade: string; leaf: string }> = {
  strawberry: { body: '#f4515f', shade: '#b8223a', leaf: '#3fae5a' },
  lemon: { body: '#ffd84a', shade: '#e0a915', leaf: '#5fae3f' },
  lime: { body: '#9fdc4a', shade: '#5f9e22', leaf: '#3f8e3a' },
  kiwi: { body: '#a3c94a', shade: '#6b5232', leaf: '#4e8a2e' },
  banana: { body: '#ffe066', shade: '#d6a817', leaf: '#6b5232' },
  grape: { body: '#9b6bd6', shade: '#5b3a9a', leaf: '#4e8a2e' },
  generic: { body: '#a78bfa', shade: '#7c3aed', leaf: '#3fae5a' },
};

export function fruitFromSpecies(species: string | undefined): Fruit {
  const s = (species ?? '').toLowerCase();
  if (/(straw|fraise|fresa)/.test(s)) return 'strawberry';
  if (/(lime|citron vert)/.test(s)) return 'lime';
  if (/(lemon|citron|limon)/.test(s)) return 'lemon';
  if (/kiwi/.test(s)) return 'kiwi';
  if (/(banan)/.test(s)) return 'banana';
  if (/(grape|raisin)/.test(s)) return 'grape';
  return 'generic';
}

/** Stylised fruit character used as a placeholder until real renders exist. */
export function FruitArt({ fruit = 'strawberry', className, mood = 'smug' }: { fruit?: Fruit; className?: string; mood?: 'smug' | 'sad' | 'shock' }) {
  const c = PALETTE[fruit];
  const id = `g-${fruit}`;
  const isStrawberry = fruit === 'strawberry';
  const isBanana = fruit === 'banana';
  return (
    <svg viewBox="0 0 100 100" className={cn('h-full w-full', className)} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="18%" stopColor={c.body} />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="92" rx="26" ry="4" fill="#000" opacity="0.35" />
      {isBanana ? (
        <path d="M22 40 Q30 88 78 78 Q60 70 52 40 Q48 30 40 28 Z" fill={`url(#${id})`} />
      ) : isStrawberry ? (
        <path d="M50 88 C28 76 18 52 24 38 C30 26 70 26 76 38 C82 52 72 76 50 88 Z" fill={`url(#${id})`} />
      ) : (
        <ellipse cx="50" cy="56" rx={fruit === 'lemon' ? 32 : 28} ry="28" fill={`url(#${id})`} />
      )}
      {isStrawberry && [[36, 46], [50, 42], [64, 46], [42, 58], [58, 58], [50, 72], [36, 66], [64, 66]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="1.4" ry="2" fill="#ffe9a8" opacity="0.85" />
      ))}
      {!isBanana && <path d="M50 30 l-12 -6 l8 8 l-8 2 l12 0 l12 0 l-8 -2 l8 -8 Z" fill={c.leaf} />}
      {/* face */}
      <g transform={isBanana ? 'translate(4,8)' : undefined}>
        <ellipse cx="41" cy="54" rx="3.2" ry={mood === 'shock' ? 4.2 : 3.6} fill="#1a1a22" />
        <ellipse cx="59" cy="54" rx="3.2" ry={mood === 'shock' ? 4.2 : 3.6} fill="#1a1a22" />
        <circle cx="42.2" cy="52.6" r="1.1" fill="#fff" />
        <circle cx="60.2" cy="52.6" r="1.1" fill="#fff" />
        {mood === 'smug' && <path d="M43 65 Q51 70 58 63" stroke="#1a1a22" strokeWidth="2" fill="none" strokeLinecap="round" />}
        {mood === 'sad' && <><path d="M43 68 Q50 63 57 68" stroke="#1a1a22" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M38 60 q-1.5 4 0 6 q1.5 -2 0 -6" fill="#8fd3ff" /></>}
        {mood === 'shock' && <ellipse cx="50" cy="67" rx="3.5" ry="4.5" fill="#1a1a22" />}
        <ellipse cx="34" cy="62" rx="4" ry="2" fill="#ff8fa3" opacity="0.45" />
        <ellipse cx="66" cy="62" rx="4" ry="2" fill="#ff8fa3" opacity="0.45" />
      </g>
      {fruit === 'lemon' && (
        <g>
          <rect x="31" y="47" width="15" height="9" rx="3" fill="#111" />
          <rect x="54" y="47" width="15" height="9" rx="3" fill="#111" />
          <path d="M46 50 h8" stroke="#111" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

const MOODS = ['smug', 'sad', 'shock'] as const;

/** 9:16 scene poster: gradient backdrop + character, deterministic per scene. */
export function ScenePoster({ species, seed = 0, className }: { species?: string; seed?: number; className?: string }) {
  const fruit = fruitFromSpecies(species);
  const hue = (seed * 47) % 360;
  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}
      style={{ background: `radial-gradient(120% 80% at 50% 0%, hsl(${hue} 60% 28%) 0%, #14141a 70%)` }}>
      <div className="absolute inset-x-[12%] bottom-[8%] top-[22%]"><FruitArt fruit={fruit} mood={MOODS[seed % 3]} /></div>
    </div>
  );
}
