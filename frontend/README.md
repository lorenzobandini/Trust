# TRUST frontend (local-first MVP)

Vite + React + Tailwind + wagmi/viem + RainbowKit. Three tabs: Groups,
Expenses, Settle. Amounts use 18 decimals (like ETH).

## Run against a local node

```bash
# 1. from repo root: compile + start node (keep running)
pnpm run compile
pnpm exec hardhat node

# 2. deploy (second terminal, repo root)
pnpm exec hardhat ignition deploy ignition/modules/TrustDeployment.ts --network localhost

# 3. copy the 4 deployed addresses into frontend/.env (see .env.example)
cp frontend/.env.example frontend/.env

# 4. start the app
cd frontend && pnpm install && pnpm dev
```

Add the Hardhat network to MetaMask: RPC `http://127.0.0.1:8545`,
chain id `31337`, and import a Hardhat test private key.
`VITE_WC_PROJECT_ID` is optional (WalletConnect only).
