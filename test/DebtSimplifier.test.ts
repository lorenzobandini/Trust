import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  deployContractsSetup,
  createGroupWithMembers,
  addExpense,
  SplitMethod,
} from './helpers';

/**
 * @title DebtSimplifier Tests
 * @notice Tests the core functionality of the DebtSimplifier smart contract, including debt graph simplification and greedy algorithm implementation.
 */
describe('DebtSimplifier', function () {
  describe('Access Control', function () {
    /**
     * @notice Ensures that only group members can simplify debts
     */
    it('should fail when non-member tries to simplify debts', async function () {
      const { debtSimplifier, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
      ]);

      await expect(
        debtSimplifier.connect(bob).simplifyDebts(groupId)
      ).to.be.revertedWith('Not a group member');
    });

    /**
     * @notice Ensures that group members can call simplifyDebts
     */
    it('should allow group members to simplify debts', async function () {
      const { debtSimplifier, groupManager, owner, alice } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
      ]);

      await expect(debtSimplifier.connect(alice).simplifyDebts(groupId)).to.not
        .be.reverted;
    });
  });

  describe('Simple Debt Scenarios', function () {
    /**
     * @notice Tests simplification when there are no debts in the group
     */
    it('should return empty arrays when no debts exist', async function () {
      const { debtSimplifier, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts(groupId);

      expect(debtors).to.have.length(0);
      expect(creditors).to.have.length(0);
      expect(amounts).to.have.length(0);
    });

    /**
     * @notice Tests simplification with a single expense creating simple debts
     */
    it('should simplify debts with single expense', async function () {
      const {
        debtSimplifier,
        expenseManager,
        groupManager,
        owner,
        alice,
        bob,
      } = await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Owner pays 60 ETH, split equally among 3 people (20 each)
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('60'),
        'Dinner',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address],
        []
      );

      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts(groupId);

      // Debtors and Creditors are edges in the debt graph
      expect(debtors).to.have.length(2);
      expect(creditors).to.have.length(2);
      expect(amounts).to.have.length(2);

      // Both Alice and Bob should owe Owner 20 ETH
      expect(debtors).to.include.members([alice.address, bob.address]);
      expect(creditors).to.include.members([owner.address, owner.address]);
      expect(amounts[0]).to.equal(ethers.parseEther('20'));
      expect(amounts[1]).to.equal(ethers.parseEther('20'));
    });
  });

  describe('Complex Debt Scenarios', function () {
    /**
     * @notice Tests debt simplification with multiple expenses creating complex debt relationships
     */
    it('should simplify debts with equally split', async function () {
      const {
        debtSimplifier,
        expenseManager,
        groupManager,
        owner,
        alice,
        bob,
        charlie,
      } = await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
        charlie,
      ]);

      // Owner pays 120 ETH, split equally among 4 people (30 each)
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

      // Alice pays 40 ETH, split equally among 4 people (10 each)
      await addExpense(
        expenseManager,
        alice,
        groupId,
        ethers.parseEther('40'),
        'Lunch',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address, charlie.address],
        []
      );

      // Bob pays 20 ETH, split equally among 4 people (5 each)
      await addExpense(
        expenseManager,
        bob,
        groupId,
        ethers.parseEther('20'),
        'Coffee',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address, charlie.address],
        []
      );

      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts(groupId);

      // Calculate expected net balances:
      // Owner: paid 120, owes 45 = +75 (creditor)
      // Alice: paid 40, owes 45 = -5 (debtor)
      // Bob: paid 20, owes 45 = -25 (debtor)
      // Charlie: paid 0, owes 45 = -45 (debtor)

      // Total debt should equal total credit (75 ETH)
      const totalDebts = amounts.reduce((sum, amount) => sum + amount, 0n);
      expect(totalDebts).to.equal(ethers.parseEther('75'));

      // Should have 3 debtors and owner as the main creditor
      expect(debtors.length).to.equal(3);
      expect(creditors.length).to.equal(3);
      expect(amounts.length).to.equal(3);

      // Verify all debtors owe to owner
      expect(creditors).to.include.members([
        owner.address,
        owner.address,
        owner.address,
      ]);
      expect(debtors).to.include.members([
        alice.address,
        bob.address,
        charlie.address,
      ]);

      // All amounts should be positive
      for (const amount of amounts) {
        expect(amount).to.be.gt(0);
      }
    });

    /**
     * @notice Tests debt simplification with percentage-based expenses
     */
    it('should simplify debts with percentage split', async function () {
      const {
        debtSimplifier,
        expenseManager,
        groupManager,
        owner,
        alice,
        bob,
      } = await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Owner pays 100 ETH with custom percentage split
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('100'),
        'Special dinner',
        SplitMethod.PERCENTAGE,
        [owner.address, alice.address, bob.address],
        [20n, 30n, 50n] // Owner 20%, Alice 30%, Bob 50%
      );

      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts(groupId);

      expect(debtors).to.have.length(2);
      expect(creditors).to.have.length(2);
      expect(amounts).to.have.length(2);

      // Owner should be credited 80 ETH (paid 100, owes 20)
      // Alice owes 30 ETH, Bob owes 50 ETH
      const totalCredits = amounts.reduce((sum, amount) => sum + amount, 0n);
      expect(totalCredits).to.equal(ethers.parseEther('80'));
    });
    /**
     * @notice Tests debt simplification with exact amounts split
     */
    it('should simplify debts with exact amounts split', async function () {
      const {
        debtSimplifier,
        expenseManager,
        groupManager,
        owner,
        alice,
        bob,
      } = await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Owner pays 90 ETH, split exactly
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('90'),
        'Concert tickets',
        SplitMethod.EXACT,
        [owner.address, alice.address, bob.address],
        [
          ethers.parseEther('30'),
          ethers.parseEther('30'),
          ethers.parseEther('30'),
        ]
      );

      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts(groupId);

      expect(debtors).to.have.length(2);
      expect(creditors).to.have.length(2);
      expect(amounts).to.have.length(2);

      // Owner should be credited 60 ETH (paid 90, owes 30)
      // Alice owes 30 ETH, Bob owes 30 ETH
      const totalCredits = amounts.reduce((sum, amount) => sum + amount, 0n);
      expect(totalCredits).to.equal(ethers.parseEther('60'));
      expect(debtors).to.include.members([alice.address, bob.address]);
      expect(creditors).to.include.members([owner.address, owner.address]);
      expect(amounts[0]).to.equal(ethers.parseEther('30'));
      expect(amounts[1]).to.equal(ethers.parseEther('30'));
    });
  });

  describe('Mixed Split Methods', function () {
    /**
     * @notice Tests debt simplification with multiple different split methods
     */
    it('should simplify debts with mixed split methods', async function () {
      const {
        debtSimplifier,
        expenseManager,
        groupManager,
        owner,
        alice,
        bob,
        charlie,
      } = await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
        charlie,
      ]);

      // Owner pays 100 ETH, split equally among 4 people (25 each)
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('100'),
        'Equal split expense',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address, charlie.address],
        []
      );

      // Alice pays 80 ETH with percentage split
      await addExpense(
        expenseManager,
        alice,
        groupId,
        ethers.parseEther('80'),
        'Percentage split expense',
        SplitMethod.PERCENTAGE,
        [owner.address, alice.address, bob.address, charlie.address],
        [10n, 40n, 30n, 20n] // Owner 10%, Alice 40%, Bob 30%, Charlie 20%
      );

      // Bob pays 60 ETH with exact amounts
      await addExpense(
        expenseManager,
        bob,
        groupId,
        ethers.parseEther('60'),
        'Exact split expense',
        SplitMethod.EXACT,
        [owner.address, alice.address, bob.address, charlie.address],
        [
          ethers.parseEther('10'),
          ethers.parseEther('15'),
          ethers.parseEther('20'),
          ethers.parseEther('15'),
        ]
      );

      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts(groupId);

      // Calculate expected net balances:
      // Owner: paid 100, owes (25 + 8 + 10) = 43, net = +57
      // Alice: paid 80, owes (25 + 32 + 15) = 72, net = +8
      // Bob: paid 60, owes (25 + 24 + 20) = 69, net = -9
      // Charlie: paid 0, owes (25 + 16 + 15) = 56, net = -56

      // Verify the simplification maintains debt conservation
      const totalDebts = amounts.reduce((sum, amount) => sum + amount, 0n);
      expect(totalDebts).to.equal(ethers.parseEther('65')); // Total of negative balances

      // Should have debtors owing to creditors
      expect(debtors.length).to.be.greaterThan(0);
      expect(creditors.length).to.be.greaterThan(0);
      expect(amounts.length).to.equal(debtors.length);

      // All amounts should be positive
      for (const amount of amounts) {
        expect(amount).to.be.gt(0);
      }

      // Verify debt graph consistency
      expect(debtors.length).to.equal(creditors.length);
      expect(debtors.length).to.equal(amounts.length);
    });
  });

  describe('Edge Cases', function () {
    /**
     * @notice Tests simplification when all balances are zero
     */
    it('should handle balanced debts correctly', async function () {
      const {
        debtSimplifier,
        expenseManager,
        groupManager,
        owner,
        alice,
        bob,
      } = await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Each person pays for themselves
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('30'),
        'Owner expense',
        SplitMethod.EXACT,
        [owner.address, alice.address, bob.address],
        [ethers.parseEther('30'), 0n, 0n]
      );

      await addExpense(
        expenseManager,
        alice,
        groupId,
        ethers.parseEther('30'),
        'Alice expense',
        SplitMethod.EXACT,
        [owner.address, alice.address, bob.address],
        [0n, ethers.parseEther('30'), 0n]
      );

      await addExpense(
        expenseManager,
        bob,
        groupId,
        ethers.parseEther('30'),
        'Bob expense',
        SplitMethod.EXACT,
        [owner.address, alice.address, bob.address],
        [0n, 0n, ethers.parseEther('30')]
      );

      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts(groupId);

      expect(debtors).to.have.length(0);
      expect(creditors).to.have.length(0);
      expect(amounts).to.have.length(0);
    });

    /**
     * @notice Tests simplification with single member group
     */
    it('should handle single member group', async function () {
      const { debtSimplifier, groupManager, owner } =
        await loadFixture(deployContractsSetup);
      await groupManager.createGroup('Solo Group', []);
      const groupId = 0;

      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts(groupId);

      expect(debtors).to.have.length(0);
      expect(creditors).to.have.length(0);
      expect(amounts).to.have.length(0);
    });
  });
});
