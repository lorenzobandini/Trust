import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  deployContractsSetup,
  createGroupWithMembers,
  addExpense,
  settleDebt,
  mintTokens,
  approveTokens,
  SplitMethod,
} from './helpers';

/**
 * @title GroupManager Tests
 * @notice Tests the core functionality of the GroupManager smart contract, including group creation, membership management, and group details retrieval.
 */
describe('GroupManager', function () {
  describe('Group Creation', function () {
    /**
     * @notice Ensures that a group can be created with an initial set of members.
     */
    it('should create a group and add initial members', async function () {
      const { groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      const members = await groupManager.getGroupMembers(groupId);
      expect(members).to.include.members([
        owner.address,
        alice.address,
        bob.address,
      ]);
    });
    /**
     * @notice Ensures that a group cannot be created with duplicate members.
     */
    it('should fail to create a group with empty name', async function () {
      const { groupManager, alice, bob } =
        await loadFixture(deployContractsSetup);
      await expect(
        groupManager.createGroup('', [alice.address, bob.address])
      ).to.be.revertedWith('Empty name');
    });
    /**
     * @notice Ensures that a group cannot be created with duplicate members.
     */
    it('should fail to create a group with duplicate members', async function () {
      const { groupManager, owner, alice } =
        await loadFixture(deployContractsSetup);
      await expect(
        groupManager.createGroup('Test Group', [
          owner.address,
          alice.address,
          owner.address,
        ])
      ).to.be.revertedWith('Member exists');
    });
  });

  describe('Group Membership', function () {
    /**
     * @notice Ensures that a member can join a group.
     */
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
    /**
     * @notice Ensures that a member cannot join a non-existent group.
     */
    it('should fail when non-member tries to join a non-existent group', async function () {
      const { groupManager, bob } = await loadFixture(deployContractsSetup);
      await expect(groupManager.connect(bob).joinGroup(999)).to.be.revertedWith(
        'Group not found'
      );
    });
    /**
     * @notice Ensures that a member can't join the same group twice.
     */
    it('should fail when member tries to join the same group twice', async function () {
      const { groupManager, owner, alice } =
        await loadFixture(deployContractsSetup);
      await createGroupWithMembers(groupManager, owner, [alice]);
      await expect(groupManager.connect(alice).joinGroup(0)).to.be.revertedWith(
        'Already a member'
      );
    });
  });
  describe('Group deletion and leaving', function () {
    it('should prevent leaving group if user has outstanding debts', async function () {
      const { groupManager, expenseManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);

      // Set up expense manager
      await groupManager.setExpenseManager(expenseManager.target);

      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Add an expense where alice owes money
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('60'),
        'Dinner',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address]
      );

      // Alice tries to leave but has outstanding debt
      await expect(
        groupManager.connect(alice).leaveGroup(groupId)
      ).to.be.revertedWith('Has debts');
    });

    it('should allow leaving after settling all debts', async function () {
      const { groupManager, expenseManager, trustToken, owner, alice, bob } =
        await loadFixture(deployContractsSetup);

      // Set up expense manager
      await groupManager.setExpenseManager(expenseManager.target);

      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Add an expense where alice owes money
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('60'),
        'Dinner',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address]
      );

      // Alice settles her debt
      await mintTokens(trustToken, alice, ethers.parseEther('20'));
      await approveTokens(
        trustToken,
        alice,
        expenseManager.target.toString(),
        ethers.parseEther('20')
      );
      await settleDebt(
        expenseManager,
        alice,
        groupId,
        owner.address,
        ethers.parseEther('20')
      );

      // Now Alice can leave
      await expect(groupManager.connect(alice).leaveGroup(groupId))
        .to.emit(groupManager, 'MemberLeft')
        .withArgs(groupId, alice.address);
    });

    it('should prevent creator from leaving group', async function () {
      const { groupManager, owner, alice } =
        await loadFixture(deployContractsSetup);

      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
      ]);

      // Owner (creator) tries to leave
      await expect(
        groupManager.connect(owner).leaveGroup(groupId)
      ).to.be.revertedWith('Creator use deleteGroup');
    });

    it('should fail leave if user is not a group member', async function () {
      const { groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);

      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
      ]);

      // Bob (not a member) tries to leave
      await expect(
        groupManager.connect(bob).leaveGroup(groupId)
      ).to.be.revertedWith('Not group member');
    });

    it('should prevent deletion if debts exist in group', async function () {
      const { groupManager, expenseManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);

      // Set up expense manager
      await groupManager.setExpenseManager(expenseManager.target);

      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Add an expense creating debts
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('60'),
        'Dinner',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address]
      );

      // Owner tries to delete but debts exist
      await expect(
        groupManager.connect(owner).deleteGroup(groupId)
      ).to.be.revertedWith('Has debts');
    });

    it('should allow deletion after all debts are settled', async function () {
      const { groupManager, expenseManager, trustToken, owner, alice, bob } =
        await loadFixture(deployContractsSetup);

      // Set up expense manager
      await groupManager.setExpenseManager(expenseManager.target);

      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Add an expense creating debts
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('60'),
        'Dinner',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address]
      );

      // Settle all debts
      await mintTokens(trustToken, alice, ethers.parseEther('20'));
      await approveTokens(
        trustToken,
        alice,
        expenseManager.target.toString(),
        ethers.parseEther('20')
      );
      await settleDebt(
        expenseManager,
        alice,
        groupId,
        owner.address,
        ethers.parseEther('20')
      );

      await mintTokens(trustToken, bob, ethers.parseEther('20'));
      await approveTokens(
        trustToken,
        bob,
        expenseManager.target.toString(),
        ethers.parseEther('20')
      );
      await settleDebt(
        expenseManager,
        bob,
        groupId,
        owner.address,
        ethers.parseEther('20')
      );

      // Now owner can delete
      await expect(groupManager.connect(owner).deleteGroup(groupId))
        .to.emit(groupManager, 'GroupDeleted')
        .withArgs(groupId, owner.address);
    });

    it('should prevent non-creator from deleting group', async function () {
      const { groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);

      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      // Alice (not creator) tries to delete
      await expect(
        groupManager.connect(alice).deleteGroup(groupId)
      ).to.be.revertedWith('Not group creator');
    });
  });
});
