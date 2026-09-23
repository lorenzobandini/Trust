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
    groupManager,
    expenseManager,
  ]);

  // Wire the contracts (set-once access control)
  m.call(groupManager, 'setExpenseManager', [expenseManager]);
  m.call(expenseManager, 'setDebtSimplifierContract', [debtSimplifier]);

  return {
    trustToken,
    groupManager,
    expenseManager,
    debtSimplifier,
  };
});

export default TrustModule;
