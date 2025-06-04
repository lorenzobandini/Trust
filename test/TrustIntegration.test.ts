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
  simplifyDebts,
  SplitMethod,
} from './helpers';

describe('TRUST Integration Test', function () {
  describe('Group Management', function () {
    it('should create a group and add members', async function () {
      const { groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);

      const initialMembers = [alice, bob];
      await createGroupWithMembers(groupManager, owner, initialMembers);

      // Verify group creation by checking members
      const groupId = 0;
      const members = await groupManager.getGroupMembers(groupId);
      expect(members).to.include.members([
        owner.address,
        alice.address,
        bob.address,
      ]);
    });

    it('should allow new members to join a group', async function () {
      const { groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);

      await createGroupWithMembers(groupManager, owner, [alice]);
      await groupManager.connect(bob).joinGroup(0);

      const members = await groupManager.getGroupMembers(0);
      expect(members).to.include.members([
        owner.address,
        alice.address,
        bob.address,
      ]);
    });
  });

  describe('Expense Management', function () {
    it('should add an expense and split it equally', async function () {
      const { groupManager, expenseManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);

      await createGroupWithMembers(groupManager, owner, [alice, bob]);

      const groupId = 0;
      const amount = ethers.parseEther('60');
      const participants = [owner.address, alice.address, bob.address];

      await addExpense(
        expenseManager,
        owner,
        groupId,
        amount,
        'Dinner at i porci comodi',
        SplitMethod.EQUAL,
        participants
      );

      // Check debts
      const debtAlice = await expenseManager.getDebt(
        groupId,
        alice.address,
        owner.address
      );
      const debtBob = await expenseManager.getDebt(
        groupId,
        bob.address,
        owner.address
      );

      expect(debtAlice).to.equal(ethers.parseEther('20'));
      expect(debtBob).to.equal(ethers.parseEther('20'));
    });

    it('should add an expense with exact amounts', async function () {
      const { groupManager, expenseManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);

      await createGroupWithMembers(groupManager, owner, [alice, bob]);

      const groupId = 0;
      const amount = ethers.parseEther('60');
      const participants = [owner.address, alice.address, bob.address];
      const splitValues = [
        ethers.parseEther('20'),
        ethers.parseEther('25'),
        ethers.parseEther('15'),
      ];

      await addExpense(
        expenseManager,
        owner,
        groupId,
        amount,
        'Dinner at i porci comodi',
        SplitMethod.EXACT,
        participants,
        splitValues
      );

      // Check debts
      const debtAlice = await expenseManager.getDebt(
        groupId,
        alice.address,
        owner.address
      );
      const debtBob = await expenseManager.getDebt(
        groupId,
        bob.address,
        owner.address
      );

      expect(debtAlice).to.equal(ethers.parseEther('25'));
      expect(debtBob).to.equal(ethers.parseEther('15'));
    });
  });

  describe('Debt Simplification', function () {
    it('should handle multiple expenses between multiple users', async function () {
      const { groupManager, expenseManager, owner, alice, bob, charlie } =
        await loadFixture(deployContractsSetup);

      await createGroupWithMembers(groupManager, owner, [alice, bob, charlie]);

      const groupId = 0;
      const amount = ethers.parseEther('60');
      const participants = [
        owner.address,
        alice.address,
        bob.address,
        charlie.address,
      ];

      // First expense paid by owner
      await addExpense(
        expenseManager,
        owner,
        groupId,
        amount,
        'Dinner',
        SplitMethod.EQUAL,
        participants
      );

      // Second expense paid by alice
      await addExpense(
        expenseManager,
        alice,
        groupId,
        amount,
        'Theater',
        SplitMethod.EQUAL,
        participants
      );

      // Verify some debts have been properly recorded
      const bobDebtToOwner = await expenseManager.getDebt(
        groupId,
        bob.address,
        owner.address
      );
      const charlieDebtToAlice = await expenseManager.getDebt(
        groupId,
        charlie.address,
        alice.address
      );

      expect(bobDebtToOwner).to.equal(ethers.parseEther('15'));
      expect(charlieDebtToAlice).to.equal(ethers.parseEther('15'));
    });

    it('should simplify complex debt graph', async function () {
      const {
        groupManager,
        expenseManager,
        debtSimplifier,
        owner,
        alice,
        bob,
        charlie,
      } = await loadFixture(deployContractsSetup);

      await createGroupWithMembers(groupManager, owner, [alice, bob, charlie]);

      const groupId = 0;

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

      // Simplify debts
      const [debtors, creditors, amounts] = await simplifyDebts(
        debtSimplifier,
        owner,
        groupId
      );

      // Verify simplification produces fewer edges than original
      expect(debtors.length).to.be.at.most(3);
      expect(creditors.length).to.be.at.most(3);

      // Verify total amounts balance
      const totalAmounts = amounts.reduce(
        (sum: bigint, amount: bigint) => sum + amount,
        0n
      );
      expect(totalAmounts).to.be.gt(0);

      // Verify creditors array is valid
      expect(creditors.length).to.equal(debtors.length);
      expect(creditors.length).to.equal(amounts.length);
    });

    it('should handle debt settlement and simplification', async function () {
      const {
        trustToken,
        groupManager,
        expenseManager,
        debtSimplifier,
        owner,
        alice,
        bob,
      } = await loadFixture(deployContractsSetup);

      await createGroupWithMembers(groupManager, owner, [alice, bob]);

      const groupId = 0;

      // Add initial expense
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('90'),
        'Restaurant',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address],
        []
      );

      // Mint tokens and settle partial debt
      await mintTokens(trustToken, alice, ethers.parseEther('1'));
      await approveTokens(
        trustToken,
        alice,
        await expenseManager.getAddress(),
        ethers.parseEther('15')
      );
      await settleDebt(
        expenseManager,
        alice,
        groupId,
        owner.address,
        ethers.parseEther('15')
      );

      // Simplify remaining debts
      const [debtors, creditors, amounts] = await simplifyDebts(
        debtSimplifier,
        owner,
        groupId
      );

      // Should have simplified debt structure
      expect(debtors.length).to.be.at.most(2);
      expect(creditors.length).to.be.at.most(2);
      expect(amounts.every((amount: bigint) => amount > 0)).to.be.true;

      // Verify arrays consistency
      expect(creditors.length).to.equal(debtors.length);
      expect(creditors.length).to.equal(amounts.length);
    });
  });

  describe('Token Management', function () {
    it('should mint tokens when sending Ether', async function () {
      const { trustToken, owner } = await loadFixture(deployContractsSetup);

      const mintAmount = ethers.parseEther('1');
      const expectedTokens = mintAmount * BigInt(1000); // MINT_RATE = 1000

      await mintTokens(trustToken, owner, mintAmount);

      const balance = await trustToken.balanceOf(owner.address);
      expect(balance).to.equal(expectedTokens);
    });

    it('should allow debt settlement with tokens', async function () {
      const { trustToken, groupManager, expenseManager, owner, alice } =
        await loadFixture(deployContractsSetup);

      // Create group and add expense
      await createGroupWithMembers(groupManager, owner, [alice]);

      const groupId = 0;
      const amount = ethers.parseEther('60');
      const participants = [owner.address, alice.address];

      await addExpense(
        expenseManager,
        owner,
        groupId,
        amount,
        'Dinner',
        SplitMethod.EQUAL,
        participants
      );

      // Mint tokens for alice
      await mintTokens(trustToken, alice, ethers.parseEther('1'));

      // Approve and settle debt
      const debtAmount = ethers.parseEther('30');
      await approveTokens(
        trustToken,
        alice,
        await expenseManager.getAddress(),
        debtAmount
      );
      await settleDebt(
        expenseManager,
        alice,
        groupId,
        owner.address,
        debtAmount
      );

      // Check remaining debt
      const remainingDebt = await expenseManager.getDebt(
        groupId,
        alice.address,
        owner.address
      );
      expect(remainingDebt).to.equal(0);
    });
  });
});
