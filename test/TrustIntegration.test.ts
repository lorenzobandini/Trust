import { expect } from 'chai';
import {
  deployContractsSetup,
  createGroupWithMembers,
  addExpense,
  mintTokens,
  approveTokens,
  settleDebt,
  simplifyDebts,
  SplitMethod,
  ethers,
  loadFixture,
} from './helpers.js';

/**
 * @title TRUST Integration Tests
 * @notice Tests the end-to-end integration between all contracts in the TRUST system
 */
describe('TRUST Integration Test', function () {
  describe('Complete Workflow Integration', function () {
    /**
     * @notice Tests the complete workflow from group creation to debt settlement
     */
    it('should handle complete workflow: group creation -> expenses -> debt settlement -> simplification', async function () {
      const {
        trustToken,
        groupManager,
        expenseManager,
        debtSimplifier,
        owner,
        alice,
        bob,
        charlie,
      } = await loadFixture(deployContractsSetup);

      // 1. Create group and add members
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
        charlie,
      ]);

      // 2. Add multiple expenses with different split methods
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('120'),
        'Hotel',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address, charlie.address],
        []
      );

      await addExpense(
        expenseManager,
        alice,
        groupId,
        ethers.parseEther('80'),
        'Dinner',
        SplitMethod.PERCENTAGE,
        [owner.address, alice.address, bob.address, charlie.address],
        [25n, 25n, 25n, 25n]
      );

      // 3. Verify initial debts
      const initialDebt = await expenseManager.getDebt(
        groupId,
        bob.address,
        owner.address
      );
      expect(initialDebt).to.be.gt(0);

      // 4. Mint tokens and settle partial debt
      await mintTokens(trustToken, bob, ethers.parseEther('1'));
      await approveTokens(
        trustToken,
        bob,
        await expenseManager.getAddress(),
        ethers.parseEther('20')
      );
      await settleDebt(
        expenseManager,
        bob,
        groupId,
        owner.address,
        ethers.parseEther('20')
      );

      // 5. Simplify remaining debts
      const [debtors, creditors, amounts] = await simplifyDebts(
        debtSimplifier,
        owner,
        groupId
      );

      // 6. Verify final state
      expect(debtors.length).to.be.at.most(3);
      expect(creditors.length).to.equal(debtors.length);
      expect(amounts.length).to.equal(debtors.length);

      // All amounts should be positive
      for (const amount of amounts) {
        expect(amount).to.be.gt(0);
      }
    });

    /**
     * @notice Tests that the system maintains debt conservation throughout all operations
     */
    it('should maintain debt conservation across all operations', async function () {
      const {
        groupManager,
        expenseManager,
        debtSimplifier,
        owner,
        alice,
        bob,
      } = await loadFixture(deployContractsSetup);

      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Add expenses and track total
      const expense1 = ethers.parseEther('90');
      const expense2 = ethers.parseEther('60');

      await addExpense(
        expenseManager,
        owner,
        groupId,
        expense1,
        'Expense 1',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address],
        []
      );

      await addExpense(
        expenseManager,
        alice,
        groupId,
        expense2,
        'Expense 2',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address],
        []
      );

      // Calculate expected net balances
      const totalExpenses = expense1 + expense2;
      const perPersonShare = totalExpenses / 3n;

      const ownerExpected = expense1 - perPersonShare; // +40
      const aliceExpected = expense2 - perPersonShare; // +10
      const bobExpected = 0n - perPersonShare; // -50

      // Verify balances
      const ownerBalance = await expenseManager.getNetBalance(
        groupId,
        owner.address
      );
      const aliceBalance = await expenseManager.getNetBalance(
        groupId,
        alice.address
      );
      const bobBalance = await expenseManager.getNetBalance(
        groupId,
        bob.address
      );

      expect(ownerBalance).to.equal(ownerExpected);
      expect(aliceBalance).to.equal(aliceExpected);
      expect(bobBalance).to.equal(bobExpected);

      // Verify total conservation (sum should be 0)
      expect(ownerBalance + aliceBalance + bobBalance).to.equal(0);

      // Simplify and verify conservation is maintained
      await debtSimplifier.connect(owner).simplifyDebts(groupId);

      const newOwnerBalance = await expenseManager.getNetBalance(
        groupId,
        owner.address
      );
      const newAliceBalance = await expenseManager.getNetBalance(
        groupId,
        alice.address
      );
      const newBobBalance = await expenseManager.getNetBalance(
        groupId,
        bob.address
      );

      expect(newOwnerBalance + newAliceBalance + newBobBalance).to.equal(0);
    });
  });
});
