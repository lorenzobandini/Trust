# DESIGN.md (prodotto)

## Posizionamento

TRUST = Splitwise on-chain. Mode **Operate**: l'utente crea gruppo, aggiunge
spesa, salda. Niente persuasione, niente landing marketing.

## Schermate MVP (3, in ordine di flusso)

1. **Gruppi** — lista gruppi dell'utente, crea gruppo (nome + membri),
   entra/esci/elimina. Mappa a `createGroup/joinGroup/leaveGroup/deleteGroup`.
2. **Spese** — per gruppo: lista spese (da eventi `ExpenseAdded`), aggiungi spesa
   (pagatore = connesso, importo, metodo EQUAL/EXACT/PERCENTAGE, partecipanti).
   Mappa a `addExpense` + `getDebt/getNetBalance`.
3. **Salda** — piano pagamenti (`simplifyDebts` → archi ottimizzati), bottone
   "paga" per arco (`mint` se servono TRUST → `approve` → `settleDebt`).

## Regole prodotto (da contratti, non negoziabili in UI)

- Leave/delete bloccati con debiti aperti → la UI deve guidare al saldo prima.
- Dust assorbita dal payer; importi redeem solo multipli di 1000.
- Fee redeem 2% visibile prima della conferma.
- Max 50 membri/gruppo; nessuna paginazione on-chain → la lista spese vive di
  log eventi, con read-model (Ponder/The Graph) quando serve (vedi DATABASE.md).

## Stack futuro (fissato, non implementato)

Vite + React + Tailwind + wagmi/viem + RainbowKit. Next.js solo per landing/SEO.
Animazioni: max 1-2 lib on-demand (`motion-primitives` + ReactBits).
Target MVP da confermare: Hardhat locale + MetaMask vs Sepolia + WalletConnect.

## Fuori MVP

Notifiche, split ricorrenti, multi-token, mobile nativo, audit UX.
