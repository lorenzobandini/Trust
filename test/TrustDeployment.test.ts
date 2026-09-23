import { expect } from 'chai';
import { network } from 'hardhat';
import TrustModule from '../ignition/modules/TrustDeployment.js';
import type {
  TrustToken,
  GroupManager,
  ExpenseManager,
  DebtSimplifier,
} from '../types/ethers-contracts/index.js';

const { ignition } = await network.create();

/**
 * @title TrustDeployment module tests
 * @notice Regression tests for the P0 wiring bugs: inverted DebtSimplifier
 * args and missing setExpenseManager / setDebtSimplifierContract calls.
 */
describe('TrustDeployment module', function () {
  it('deploys wired contracts with correct constructor order', async function () {
    const deployed = await ignition.deploy(TrustModule);

    const trustToken = deployed.trustToken as unknown as TrustToken;
    const groupManager = deployed.groupManager as unknown as GroupManager;
    const expenseManager = deployed.expenseManager as unknown as ExpenseManager;
    const debtSimplifier = deployed.debtSimplifier as unknown as DebtSimplifier;

    const gmAddr = await groupManager.getAddress();
    const emAddr = await expenseManager.getAddress();
    const dsAddr = await debtSimplifier.getAddress();
    const ttAddr = await trustToken.getAddress();
    for (const a of [gmAddr, emAddr, dsAddr, ttAddr]) {
      expect(a).to.match(/^0x[0-9a-fA-F]{40}$/);
    }

    // Wiring calls happened
    expect(await groupManager.expenseManager()).to.equal(emAddr);
    expect(await expenseManager.debtSimplifierContract()).to.equal(dsAddr);

    // Constructor args in the right order (not inverted)
    expect(await debtSimplifier.GROUP_MANAGER()).to.equal(gmAddr);
    expect(await debtSimplifier.EXPENSE_MANAGER()).to.equal(emAddr);
  });
});
