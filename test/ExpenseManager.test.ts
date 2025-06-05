import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  deployContractsSetup,
  createGroupWithMembers,
  addExpense,
  mintTokens,
  approveTokens,
  settleDebt,
  SplitMethod,
} from './helpers';

/**
 * @title ExpenseManager Tests
 * @notice Tests the core functionality of the ExpenseManager smart contract, including expense creation, debt settlement, and debt tracking.
 */
describe('ExpenseManager', function () {
  describe('Expense Management', function () {
    /**
     * @notice Ensures that expenses can be created with equal split among participants
     */
    it('should add an expense with equal split', async function () {
      const { expenseManager, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);
      const amount = ethers.parseEther('60');
      const description = 'Lunch';
      const participants = [owner.address, alice.address, bob.address];

      await addExpense(
        expenseManager,
        owner,
        groupId,
        amount,
        description,
        SplitMethod.EQUAL,
        participants,
        []
      );

      const expense = await expenseManager.expenses(0n);
      expect(expense.amount).to.equal(amount);
      expect(expense.description).to.equal(description);
      expect(expense.payer).to.equal(owner.address);
    });

    /**
     * @notice Ensures that expenses can be created with exact split amounts per participant
     */
    it('should add an expense with exact split', async function () {
      const { expenseManager, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);
      const amount = ethers.parseEther('70');
      const description = 'Lunch';
      const participants = [owner.address, alice.address, bob.address];
      const splitValues = [
        ethers.parseEther('20'),
        ethers.parseEther('20'),
        ethers.parseEther('30'),
      ];

      await addExpense(
        expenseManager,
        owner,
        groupId,
        amount,
        description,
        SplitMethod.EXACT,
        participants,
        splitValues
      );

      const expense = await expenseManager.expenses(0n);
      expect(expense.amount).to.equal(amount);
      expect(expense.description).to.equal(description);
      expect(expense.payer).to.equal(owner.address);
    });

    /**
     * @notice Ensures that expenses can be created with percentage-based split
     */
    it('should add an expense with percentage split', async function () {
      const { expenseManager, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);
      const amount = ethers.parseEther('100');
      const description = 'Lunch';
      const participants = [owner.address, alice.address, bob.address];
      const splitValues = [50n, 30n, 20n];

      await addExpense(
        expenseManager,
        owner,
        groupId,
        amount,
        description,
        SplitMethod.PERCENTAGE,
        participants,
        splitValues
      );

      const expense = await expenseManager.expenses(0n);
      expect(expense.amount).to.equal(amount);
      expect(expense.description).to.equal(description);
      expect(expense.payer).to.equal(owner.address);
    });

    /**
     * @notice Ensures that adding expenses with mismatched participants and split values fails
     */
    it('should fail to add expense with invalid split values', async function () {
      const { expenseManager, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);
      const amount = ethers.parseEther('60');
      const description = 'Lunch';
      const participants = [owner.address, alice.address, bob.address];
      const splitValues = [ethers.parseEther('20'), ethers.parseEther('20')]; // Only 2 values for 3 participants

      await expect(
        addExpense(
          expenseManager,
          owner,
          groupId,
          amount,
          description,
          SplitMethod.EXACT,
          participants,
          splitValues
        )
      ).to.be.revertedWith('Length mismatch');
    });

    /**
     * @notice Ensures that percentage splits must total exactly 100%
     */
    it('should fail when percentage split does not total 100%', async function () {
      const { expenseManager, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);
      const amount = ethers.parseEther('100');
      const description = 'Dinner';
      const participants = [owner.address, alice.address, bob.address];
      const splitValues = [50n, 20n, 20n]; // Only 90% total

      await expect(
        addExpense(
          expenseManager,
          owner,
          groupId,
          amount,
          description,
          SplitMethod.PERCENTAGE,
          participants,
          splitValues
        )
      ).to.be.revertedWith('Percentage sum != 100');
    });

    /**
     * @notice Ensures that individual percentage values cannot exceed 100%
     */
    it('should fail when percentage split exceeds 100%', async function () {
      const { expenseManager, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);
      const amount = ethers.parseEther('100');
      const description = 'Dinner';
      const participants = [owner.address, alice.address, bob.address];
      const splitValues = [120n, 30n, 30n]; // 120% is invalid

      await expect(
        addExpense(
          expenseManager,
          owner,
          groupId,
          amount,
          description,
          SplitMethod.PERCENTAGE,
          participants,
          splitValues
        )
      ).to.be.revertedWith('Invalid percentage');
    });
  });

  describe('Debt Settlement', function () {
    /**
     * @notice Ensures that a member can settle debt with the group's payer
     */
    it('should settle debt between two members', async function () {
      const { expenseManager, groupManager, trustToken, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Add expense and mint tokens
      const amount = ethers.parseEther('60');
      const participants = [owner.address, alice.address, bob.address];
      await addExpense(
        expenseManager,
        owner,
        groupId,
        amount,
        'Lunch',
        SplitMethod.EQUAL,
        participants,
        []
      );
      await mintTokens(trustToken, alice, ethers.parseEther('20'));
      await approveTokens(
        trustToken,
        alice,
        expenseManager.target.toString(),
        ethers.parseEther('20')
      );

      // Settle debt
      await settleDebt(
        expenseManager,
        alice,
        groupId,
        owner.address.toString(),
        ethers.parseEther('20')
      );

      const debt = await expenseManager.getDebt(
        groupId,
        alice.address.toString(),
        owner.address.toString()
      );
      expect(debt).to.equal(0);
    });

    /**
     * @notice Ensures that settling debt fails when token allowance is insufficient
     */
    it('should fail to settle debt with insufficient allowance', async function () {
      const { expenseManager, groupManager, trustToken, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Add expense and mint tokens
      const amount = ethers.parseEther('60');
      const participants = [owner.address, alice.address, bob.address];
      await addExpense(
        expenseManager,
        owner,
        groupId,
        amount,
        'Lunch',
        SplitMethod.EQUAL,
        participants,
        []
      );
      await mintTokens(trustToken, alice, ethers.parseEther('20'));
      await approveTokens(
        trustToken,
        alice,
        expenseManager.target.toString(),
        ethers.parseEther('10')
      ); // Only approve 10 tokens

      // Try to settle debt
      await expect(
        settleDebt(
          expenseManager,
          alice,
          groupId,
          owner.address.toString(),
          ethers.parseEther('20')
        )
      ).to.be.revertedWithCustomError(trustToken, 'ERC20InsufficientAllowance');
    });
    /**
     * @notice Ensures that settling debt fails when trying to settle debt with oneself
     */
    it('should fail when payer tries to settle debt with himself', async function () {
      const { expenseManager, groupManager, trustToken, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Add expense where alice is the payer instead of owner
      const amount = ethers.parseEther('60');
      const participants = [owner.address, alice.address, bob.address];
      await addExpense(
        expenseManager,
        alice,
        groupId,
        amount,
        'Lunch',
        SplitMethod.EQUAL,
        participants,
        []
      );

      // Mint and approve tokens for alice
      await mintTokens(trustToken, alice, ethers.parseEther('20'));
      await approveTokens(
        trustToken,
        alice,
        expenseManager.target.toString(),
        ethers.parseEther('20')
      );

      // Try to settle debt with herself
      await expect(
        settleDebt(
          expenseManager,
          alice,
          groupId,
          alice.address.toString(),
          ethers.parseEther('20')
        )
      ).to.be.revertedWith('Cannot pay yourself');
    });
  });

  describe('Debt Information', function () {
    /**
     * @notice Ensures that debt amounts are correctly calculated and stored
     */
    it('should return correct debt information', async function () {
      const { expenseManager, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Add expense
      const amount = ethers.parseEther('60');
      const participants = [owner.address, alice.address, bob.address];
      await addExpense(
        expenseManager,
        owner,
        groupId,
        amount,
        'Lunch',
        SplitMethod.EQUAL,
        participants,
        []
      );

      // Check debts
      const aliceDebt = await expenseManager.getDebt(
        groupId,
        alice.address.toString(),
        owner.address.toString()
      );
      const bobDebt = await expenseManager.getDebt(
        groupId,
        bob.address.toString(),
        owner.address.toString()
      );

      expect(aliceDebt).to.equal(ethers.parseEther('20'));
      expect(bobDebt).to.equal(ethers.parseEther('20'));
    });

    /**
     * @notice Ensures that querying debt for non-existent groups returns zero
     */
    it('should return zero debt for non-existent group', async function () {
      const { expenseManager, owner, alice } =
        await loadFixture(deployContractsSetup);
      const debt = await expenseManager.getDebt(
        999,
        alice.address.toString(),
        owner.address.toString()
      );
      expect(debt).to.equal(0);
    });
  });
});
