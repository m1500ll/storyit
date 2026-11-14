import { ArrowUpRight, Gift, Flame, Users } from 'lucide-react';
import { cn } from '@/lib/cn';

export const DISCORD_URL = 'https://discord.gg/S3A9Jg5xe';

/** Discord's mark (simplified), for the community buttons */
export function DiscordIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M19.6 5.3A17.6 17.6 0 0 0 15.2 4l-.6 1.1a16.3 16.3 0 0 0-5.2 0L8.8 4a17.5 17.5 0 0 0-4.4 1.3C1.6 9.4.9 13.4 1.2 17.4a17.7 17.7 0 0 0 5.4 2.6l1.1-1.8a11.5 11.5 0 0 1-1.8-.8l.4-.3a12.6 12.6 0 0 0 11.4 0l.4.3c-.6.3-1.2.6-1.8.8l1.1 1.8a17.6 17.6 0 0 0 5.4-2.6c.4-4.7-.7-8.6-3.2-12.1ZM8.7 15c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.6 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z" />
    </svg>
  );
}

/** Sidebar / menu entry: opens the Discord in a new tab, with a live dot to draw the eye */
export function CommunityLink({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" onClick={onClick}
      className={cn('group flex items-center gap-3 rounded-xl bg-[#5865F2]/10 px-3 py-2.5 text-sm font-medium text-zinc-100 ring-1 ring-[#5865F2]/30 transition hover:bg-[#5865F2]/20 hover:ring-[#5865F2]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]', className)}>
      <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-[#5865F2] text-white transition group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none">
        <DiscordIcon className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
      </span>
      <span className="min-w-0 flex-1">Communauté<span className="block text-[11px] font-normal text-zinc-400">Rejoindre le Discord</span></span>
      <ArrowUpRight className="h-4 w-4 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-200" aria-hidden />
    </a>
  );
}

const PERKS = [
  { icon: Gift, text: 'Offres exclusives bientôt, réservées aux membres' },
  { icon: Flame, text: 'Les idées et formats qui cartonnent' },
  { icon: Users, text: 'Entraide entre créateurs et nouveautés en avant-première' },
];

/** Dashboard card: the community in one look, with the join button */
export function CommunityCard() {
  return (
    <section aria-labelledby="community-title" className="group relative mb-8 overflow-hidden rounded-3xl border border-[#5865F2]/35 bg-gradient-to-br from-[#5865F2]/20 via-ink-950 to-violet-600/10 p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#5865F2]/30 blur-3xl transition-transform duration-700 group-hover:scale-125 motion-reduce:transition-none" />
      <div className="relative grid items-center gap-5 sm:grid-cols-[auto_1fr_auto]">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/40 transition group-hover:-rotate-6 group-hover:scale-105 motion-reduce:transition-none">
          <DiscordIcon className="h-8 w-8" />
        </span>
        <div className="min-w-0">
          <h2 id="community-title" className="text-balance font-display text-2xl text-zinc-50">La communauté Storyit est ouverte</h2>
          <ul className="mt-2 grid gap-1 text-sm text-zinc-300 sm:grid-cols-3 sm:gap-3">
            {PERKS.map(({ icon: Icon, text }) => <li key={text} className="flex items-start gap-1.5"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#8b93ff]" aria-hidden />{text}</li>)}
          </ul>
        </div>
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-5 text-sm font-semibold text-white shadow-lg shadow-[#5865F2]/30 transition hover:-translate-y-0.5 hover:bg-[#4752c4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b93ff] motion-reduce:transition-none">
          <DiscordIcon className="h-5 w-5" /> Rejoindre le Discord
        </a>
      </div>
    </section>
  );
}

/** Landing band: the community, for visitors (French or English) */
export function CommunityBand({ fr }: { fr: boolean }) {
  return (
    <section aria-labelledby="community-band" className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
        className="group relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-[#5865F2]/40 bg-gradient-to-r from-[#5865F2]/25 via-violet-600/10 to-transparent p-6 text-center transition hover:border-[#5865F2]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b93ff] sm:flex-row sm:p-8 sm:text-left">
        <span aria-hidden className="pointer-events-none absolute -left-10 -top-16 h-52 w-52 rounded-full bg-[#5865F2]/30 blur-3xl transition-transform duration-700 group-hover:scale-125 motion-reduce:transition-none" />
        <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/40 transition group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transition-none"><DiscordIcon className="h-9 w-9" /></span>
        <span className="relative min-w-0 flex-1">
          <span id="community-band" className="block text-balance font-display text-2xl text-zinc-50 md:text-3xl">{fr ? 'Rejoins la communauté Storyit sur Discord' : 'Join the Storyit community on Discord'}</span>
          <span className="mt-1 block text-sm text-zinc-300">{fr ? 'Entraide entre créateurs, formats qui cartonnent, nouveautés en avant-première et bientôt des offres réservées aux membres.' : 'Creators helping each other, formats that work, early access to new features and member-only offers soon.'}</span>
        </span>
        <span className="relative inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#5865F2] px-5 text-sm font-semibold text-white transition group-hover:-translate-y-0.5 motion-reduce:transition-none">
          {fr ? 'Rejoindre le Discord' : 'Join the Discord'} <ArrowUpRight className="h-4 w-4" aria-hidden />
        </span>
      </a>
    </section>
  );
}
