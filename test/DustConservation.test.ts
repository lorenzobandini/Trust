import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  deployContractsSetup,
  createGroupWithMembers,
  addExpense,
  mintTokens,
  SplitMethod,
} from './helpers';

/**
 * @title Dust conservation tests (TDD RED)
 * @notice Non-divisible amounts must preserve sum(net balances) == 0.
 * Payer absorbs the remainder; redeem reverts on non-multiple amounts.
 */
describe('Dust conservation', function () {
  it('EQUAL: sum of net balances is 0 for non-divisible amount', async function () {
    const { groupManager, expenseManager, owner, alice, bob } =
      await loadFixture(deployContractsSetup);
    const groupId = await createGroupWithMembers(groupManager, owner, [
      alice,
      bob,
    ]);

    // 10 wei / 3 members -> share 3, remainder 1
    await addExpense(
      expenseManager,
      owner,
      groupId,
      10n,
      'Dust dinner',
      SplitMethod.EQUAL,
      [owner.address, alice.address, bob.address],
      []
    );

    const o = await expenseManager.getNetBalance(groupId, owner.address);
    const a = await expenseManager.getNetBalance(groupId, alice.address);
    const b = await expenseManager.getNetBalance(groupId, bob.address);
    expect(o + a + b).to.equal(0n);
    // payer absorbs remainder: credited 9 (3*3), debited 3 -> +6
    expect(o).to.equal(6n);
    expect(a).to.equal(-3n);
    expect(b).to.equal(-3n);
  });

  it('PERCENTAGE: sum of net balances is 0 when shares truncate', async function () {
    const { groupManager, expenseManager, owner, alice, bob } =
      await loadFixture(deployContractsSetup);
    const groupId = await createGroupWithMembers(groupManager, owner, [
      alice,
      bob,
    ]);

    // 10 * 33/100 = 3 (truncated) x2, 10 * 34/100 = 3 -> distributed 9, remainder 1
    await addExpense(
      expenseManager,
      owner,
      groupId,
      10n,
      'Dust pct',
      SplitMethod.PERCENTAGE,
      [owner.address, alice.address, bob.address],
      [33n, 33n, 34n]
    );

    const o = await expenseManager.getNetBalance(groupId, owner.address);
    const a = await expenseManager.getNetBalance(groupId, alice.address);
    const b = await expenseManager.getNetBalance(groupId, bob.address);
    expect(o + a + b).to.equal(0n);
  });

  it('redeem reverts on token amounts that are not multiples of MINT_RATE', async function () {
    const { trustToken, owner } = await loadFixture(deployContractsSetup);
    await mintTokens(trustToken, owner, ethers.parseEther('2'));
    // 1500 tokens -> 1 wei + dust; must revert instead of silently burning dust
    await expect(trustToken.connect(owner).redeem(1500n)).to.be.revertedWith(
      'Amount not multiple'
    );
  });
});
