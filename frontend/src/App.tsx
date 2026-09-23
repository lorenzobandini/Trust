import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ADDRESSES_SET } from './contracts';
import { Groups } from './components/Groups';
import { Expenses } from './components/Expenses';
import { Settle } from './components/Settle';

const TABS = ['Groups', 'Expenses', 'Settle'] as const;

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Groups');
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">TRUST</h1>
        <ConnectButton />
      </header>
      {!ADDRESSES_SET && (
        <p className="rounded bg-yellow-100 p-2 text-sm">
          Contract addresses missing — copy them from the Ignition deploy output
          into <code>.env</code> (see README).
        </p>
      )}
      <nav className="flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-sm ${tab === t ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>
            {t}
          </button>
        ))}
      </nav>
      {tab === 'Groups' && <Groups />}
      {tab === 'Expenses' && <Expenses />}
      {tab === 'Settle' && <Settle />}
    </div>
  );
}
