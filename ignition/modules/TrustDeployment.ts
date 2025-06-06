import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const TrustModule = buildModule('TrustModule', (m) => {
  // Deploy TrustToken first
  const trustToken = m.contract('TrustToken');

  // Deploy GroupManager
  const groupManager = m.contract('GroupManager');

  // Deploy ExpenseManager
  const expenseManager = m.contract('ExpenseManager', [
    groupManager,
    trustToken,
  ]);

  // Deploy DebtSimplifier
  const debtSimplifier = m.contract('DebtSimplifier', [
    expenseManager,
    groupManager,
  ]);

  return {
    trustToken,
    groupManager,
    expenseManager,
    debtSimplifier,
  };
});

export default TrustModule;
