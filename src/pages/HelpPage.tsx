import { Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FAQ } from '@/components/landing/FAQ';
import { Card, PageHeader } from '@/components/ui';

export default function HelpPage() {
  return (
    <>
      <PageHeader eyebrow="Account" title="Help" description="Answers to common questions, and how to reach us." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm font-semibold text-zinc-100">Getting started</p><p className="mt-1 text-sm text-zinc-400">Create your first episode in about a minute.</p><Link to="/app/new" className="mt-3 inline-block text-xs text-violet-300">New episode →</Link></Card>
        <Card><p className="text-sm font-semibold text-zinc-100">Grow & monetise</p><p className="mt-1 text-sm text-zinc-400">Platform rules and what works for story series.</p><Link to="/app/guide" className="mt-3 inline-block text-xs text-violet-300">Creator guide →</Link></Card>
        <Card><p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100"><Mail className="h-4 w-4" /> Contact</p><p className="mt-1 text-sm text-zinc-400">A question, a bug, a refund? Write to us.</p><a href="mailto:hello@storyit.io" className="mt-3 inline-block text-xs text-violet-300">hello@storyit.io →</a></Card>
      </div>
      <div className="-mx-4 md:-mx-6"><FAQ /></div>
    </>
  );
}
