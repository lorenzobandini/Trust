import { http } from 'wagmi';
import { hardhat } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Local-first MVP: Hardhat node + localhost transport. Default wallets
// include injected ones (MetaMask). Set VITE_WC_PROJECT_ID in .env to
// also enable WalletConnect.
export const config = getDefaultConfig({
  appName: 'TRUST',
  projectId: import.meta.env.VITE_WC_PROJECT_ID ?? 'LOCAL_DEV_ONLY',
  chains: [hardhat],
  transports: { [hardhat.id]: http('http://127.0.0.1:8545') },
  ssr: false,
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
