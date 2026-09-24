import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { MotionConfig, motion } from 'motion/react';
import { useAccount } from 'wagmi';
import { ADDRESSES_SET } from './contracts';
import { NamesProvider } from './lib/names';
import { Groups } from './components/Groups';
import { Expenses } from './components/Expenses';
import { Settle } from './components/Settle';

const TABS = [
  { id: 'Groups', step: '1 — Gather people' },
  { id: 'Expenses', step: '2 — Track spending' },
  { id: 'Settle', step: '3 — Pay up' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export default function App() {
  const { address } = useAccount();
  const [tab, setTab] = useState<Tab>('Groups');
  const [activeId, setActiveId] = useState<number | null>(null);

  return (
    <MotionConfig reducedMotion="user">
      <NamesProvider>
        <div className="mx-auto max-w-2xl space-y-4 p-4 pb-16">
          <header className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-6 w-6 rounded-[6px] bg-emerald-500" />
              <div>
                <h1 className="text-lg font-bold leading-none">TRUST</h1>
                <p className="text-xs text-zinc-500">Split expenses on-chain</p>
              </div>
            </div>
            <ConnectButton />
          </header>

          {!ADDRESSES_SET && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              Contract addresses missing — copy them from the Ignition deploy
              output into <code className="font-mono">frontend/.env</code> (see README).
            </p>
          )}

          <ol className="flex gap-1 text-xs text-zinc-500">
            {TABS.map((t) => (
              <li
                key={t.id}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-center ${
                  tab === t.id ? 'border-emerald-500/50 text-zinc-200' : 'border-zinc-800'
                }`}
              >
                {t.step}
              </li>
            ))}
          </ol>

          <nav className="flex gap-1 rounded-xl bg-zinc-900 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  tab === t.id ? 'text-emerald-950' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-lg bg-emerald-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{t.id}</span>
              </button>
            ))}
          </nav>

          <motion.main
            key={tab + String(activeId)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'Groups' && (
              <Groups account={address} activeId={activeId} onSelect={setActiveId} />
            )}
            {tab === 'Expenses' && <Expenses groupId={activeId} />}
            {tab === 'Settle' && <Settle groupId={activeId} />}
          </motion.main>
        </div>
      </NamesProvider>
    </MotionConfig>
  );
}
