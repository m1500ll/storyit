import { CalendarClock, CheckCircle2, FolderUp, Link2 } from 'lucide-react';

const steps = [
  { icon: Link2, title: 'Connect your accounts', body: 'Log in to TikTok and Instagram on their own pages. Storyit never sees your passwords.' },
  { icon: FolderUp, title: 'Import your videos once', body: 'Your library holds every video. Large files are compressed on your device before upload.' },
  { icon: CalendarClock, title: 'Choose how they go out', body: 'Send one video to several accounts at once, or let a daily rotation pick new videos for you.' },
  { icon: CheckCircle2, title: 'Approve, then it runs', body: 'Check each caption and account. The server publishes on time and shows the status the platform returns.' },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">How it works</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">From one upload to every account, in four steps</h2>
      <ol className="mt-12 grid gap-4 md:grid-cols-4">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="surface relative p-6">
            <span aria-hidden="true" className="absolute right-5 top-4 font-display text-4xl text-line/[0.07]">{i + 1}</span>
            <Icon className="h-5 w-5 text-coral-400" aria-hidden="true" />
            <h3 className="mt-4 text-sm font-semibold text-zinc-100">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
