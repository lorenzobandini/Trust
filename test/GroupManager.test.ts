import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployContractsSetup, createGroupWithMembers } from './helpers';

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
      ).to.be.revertedWith('Group name cannot be empty');
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
      ).to.be.revertedWith('Member already in group');
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
        'Group does not exist'
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
});
