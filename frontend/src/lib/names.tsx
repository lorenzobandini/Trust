import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { shortAddr } from './format';

const KEY = 'trust-address-book';

function load(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

interface Names {
  name: (addr: string) => string;
  rename: (addr: string, next: string) => void;
}

const NamesCtx = createContext<Names>({
  name: (a) => shortAddr(a),
  rename: () => {},
});

export function NamesProvider({ children }: { children: ReactNode }) {
  const [book, setBook] = useState<Record<string, string>>(load);

  const rename = useCallback((addr: string, next: string) => {
    setBook((b) => {
      const nb = { ...b };
      const k = addr.toLowerCase();
      if (next.trim()) nb[k] = next.trim();
      else delete nb[k];
      localStorage.setItem(KEY, JSON.stringify(nb));
      return nb;
    });
  }, []);

  const name = useCallback(
    (addr: string) => book[addr.toLowerCase()] ?? shortAddr(addr),
    [book]
  );

  return (
    <NamesCtx.Provider value={{ name, rename }}>
      {children}
    </NamesCtx.Provider>
  );
}

export function useNames(): Names {
  return useContext(NamesCtx);
}
