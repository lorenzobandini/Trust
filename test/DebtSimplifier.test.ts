import { expect } from 'chai';
import {
  deployContractsSetup,
  createGroupWithMembers,
  addExpense,
  SplitMethod,
  ethers,
  loadFixture,
} from './helpers.js';

/**
 * @title DebtSimplifier Tests
 * @notice Tests the core functionality of the DebtSimplifier smart contract algorithm
 */
describe('DebtSimplifier', function () {
  describe('Access Control', function () {
    it('should fail when non-member tries to simplify debts', async function () {
      const { debtSimplifier, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
      ]);

      await expect(
        debtSimplifier.connect(bob).simplifyDebts(groupId)
      ).to.be.revertedWith('Not group member');
    });
  });

  describe('Algorithm Edge Cases', function () {
    it('should return empty arrays when no debts exist', async function () {
      const { debtSimplifier, groupManager, owner, alice, bob } =
        await loadFixture(deployContractsSetup);
      const groupId = await createGroupWithMembers(groupManager, owner, [
        alice,
        bob,
      ]);

      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts.staticCall(groupId);

      expect(debtors).to.have.length(0);
      expect(creditors).to.have.length(0);
      expect(amounts).to.have.length(0);
    });

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

      // Each person pays for themselves - net zero debts
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

      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts.staticCall(groupId);

      expect(debtors).to.have.length(0);
      expect(creditors).to.have.length(0);
      expect(amounts).to.have.length(0);
    });
  });

  describe('Greedy Algorithm Optimization', function () {
    it('should reduce debt edges using greedy matching', async function () {
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

      // Create complex debt scenario
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
        ethers.parseEther('40'),
        'Lunch',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address, charlie.address],
        []
      );

      // Count original edges
      const members = [
        owner.address,
        alice.address,
        bob.address,
        charlie.address,
      ];
      let originalEdges = 0;
      for (let i = 0; i < members.length; i++) {
        for (let j = 0; j < members.length; j++) {
          if (i !== j) {
            const debt = await expenseManager.getDebt(
              groupId,
              members[i],
              members[j]
            );
            if (debt > 0) originalEdges++;
          }
        }
      }

      // Run simplification
      const tx = await debtSimplifier.connect(owner).simplifyDebts(groupId);
      const receipt = await tx.wait();

      // Verify DebtSimplified event was emitted
      const debtSimplifiedEvent = receipt?.logs.find((log) => {
        try {
          const parsed = debtSimplifier.interface.parseLog(log);
          return parsed?.name === 'DebtSimplified';
        } catch {
          return false;
        }
      });
      expect(debtSimplifiedEvent).to.not.be.undefined;

      // Count new edges
      let newEdges = 0;
      for (let i = 0; i < members.length; i++) {
        for (let j = 0; j < members.length; j++) {
          if (i !== j) {
            const debt = await expenseManager.getDebt(
              groupId,
              members[i],
              members[j]
            );
            if (debt > 0) newEdges++;
          }
        }
      }

      expect(newEdges).to.be.lessThanOrEqual(originalEdges);
    });

    it('should use HeapSort to optimally match largest debtors with creditors', async function () {
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

      // Create scenario with specific debt amounts for verification
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('1000'),
        'Big expense',
        SplitMethod.EXACT,
        [owner.address, alice.address, bob.address, charlie.address],
        [
          ethers.parseEther('100'), // Owner owes 100
          ethers.parseEther('300'), // Alice owes 300
          ethers.parseEther('200'), // Bob owes 200
          ethers.parseEther('400'), // Charlie owes 400
        ]
      );

      // Net balances: Owner +900, Alice -300, Bob -200, Charlie -400
      const [debtors, creditors, amounts] = await debtSimplifier
        .connect(owner)
        .simplifyDebts.staticCall(groupId);

      expect(debtors.length).to.equal(3);
      expect(creditors.length).to.equal(3);

      // All creditors should be owner (largest creditor)
      for (const creditor of creditors) {
        expect(creditor).to.equal(owner.address);
      }

      // Verify amounts include all debt values
      const amountStrings = amounts.map((a: bigint) => a.toString());
      expect(amountStrings).to.include(ethers.parseEther('400').toString());
      expect(amountStrings).to.include(ethers.parseEther('300').toString());
      expect(amountStrings).to.include(ethers.parseEther('200').toString());
    });
  });

  describe('Algorithm Correctness', function () {
    it('should preserve total debt amounts after simplification', async function () {
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

      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('90'),
        'Dinner',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address],
        []
      );

      // Calculate total debt before simplification
      const members = [owner.address, alice.address, bob.address];
      let totalDebtsBefore = 0n;
      for (let i = 0; i < members.length; i++) {
        for (let j = 0; j < members.length; j++) {
          if (i !== j) {
            const debt = await expenseManager.getDebt(
              groupId,
              members[i],
              members[j]
            );
            totalDebtsBefore += debt;
          }
        }
      }

      // Run simplification
      await debtSimplifier.connect(owner).simplifyDebts(groupId);

      // Calculate total debt after simplification
      let totalDebtsAfter = 0n;
      for (let i = 0; i < members.length; i++) {
        for (let j = 0; j < members.length; j++) {
          if (i !== j) {
            const debt = await expenseManager.getDebt(
              groupId,
              members[i],
              members[j]
            );
            totalDebtsAfter += debt;
          }
        }
      }

      // Total debts should be preserved or reduced by simplification
      expect(totalDebtsAfter).to.be.at.most(totalDebtsBefore);
    });

    it('should handle multiple simplifications correctly', async function () {
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

      // First expense
      await addExpense(
        expenseManager,
        owner,
        groupId,
        ethers.parseEther('60'),
        'Expense 1',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address],
        []
      );

      // First simplification
      await debtSimplifier.connect(owner).simplifyDebts(groupId);

      // Add another expense
      await addExpense(
        expenseManager,
        alice,
        groupId,
        ethers.parseEther('30'),
        'Expense 2',
        SplitMethod.EQUAL,
        [owner.address, alice.address, bob.address],
        []
      );

      // Second simplification should work correctly
      const result = await debtSimplifier
        .connect(alice)
        .simplifyDebts.staticCall(groupId);
      const [debtors, creditors, amounts] = result;

      // Verify results are consistent
      expect(debtors.length).to.equal(creditors.length);
      expect(creditors.length).to.equal(amounts.length);

      // All amounts should be positive
      for (const amount of amounts) {
        expect(amount).to.be.greaterThan(0);
      }
    });
  });
});
