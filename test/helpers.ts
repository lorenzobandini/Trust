import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  TrustToken,
  GroupManager,
  ExpenseManager,
  DebtSimplifier,
} from '../typechain-types';

// Define SplitMethod enum locally to match the contract
export enum SplitMethod {
  EQUAL,
  EXACT,
  PERCENTAGE,
}

// Interface for all the context needed in tests
export interface TestContext {
  trustToken: TrustToken;
  groupManager: GroupManager;
  expenseManager: ExpenseManager;
  debtSimplifier: DebtSimplifier;
  owner: SignerWithAddress;
  alice: SignerWithAddress;
  bob: SignerWithAddress;
  charlie: SignerWithAddress;
}

/**
 * @title deployContractsSetup
 * @author Lorenzo Bandini
 * @description Deploys the necessary contracts for testing and returns a context object containing them.
 * @returns A TestContext object containing deployed contracts and signers
 */
export async function deployContractsSetup(): Promise<TestContext> {
  const [owner, alice, bob, charlie] = await ethers.getSigners();

  // Deploy contracts
  const TrustToken = await ethers.getContractFactory('TrustToken');
  const trustToken = await TrustToken.deploy();

  const GroupManager = await ethers.getContractFactory('GroupManager');
  const groupManager = await GroupManager.deploy();

  const ExpenseManager = await ethers.getContractFactory('ExpenseManager');
  const expenseManager = await ExpenseManager.deploy(
    await groupManager.getAddress(),
    await trustToken.getAddress()
  );

  const DebtSimplifier = await ethers.getContractFactory('DebtSimplifier');
  const debtSimplifier = await DebtSimplifier.deploy(
    await groupManager.getAddress(),
    await expenseManager.getAddress()
  );

  return {
    trustToken,
    groupManager,
    expenseManager,
    debtSimplifier,
    owner,
    alice,
    bob,
    charlie,
  };
}

/**
 * @title createGroupWithMembers
 * @author Lorenzo Bandini
 * @param groupManager - The GroupManager contract instance
 * @param _owner - The owner of the group
 * @param members - The initial members of the group
 * @returns The ID of the created group
 */
export async function createGroupWithMembers(
  groupManager: GroupManager,
  _owner: SignerWithAddress,
  members: SignerWithAddress[]
): Promise<number> {
  // TODO: don't use a test group with a fixed id but use the one returned by the contract with its id
  await groupManager.createGroup(
    'Test Group',
    members.map((m) => m.address)
  );
  return 0;
}

/**
 * @title addExpense
 * @author Lorenzo Bandini
 * @param expenseManager - The ExpenseManager contract instance
 * @param payer - The user paying the expense
 * @param groupId - The ID of the group the expense belongs to
 * @param amount - The total amount of the expense
 * @param description - A description of the expense
 * @param splitMethod - The method used to split the expense
 * @param participants - The users participating in the expense
 * @param splitValues - The amounts each participant should pay (optional)
 */
export async function addExpense(
  expenseManager: ExpenseManager,
  payer: SignerWithAddress,
  groupId: number,
  amount: bigint,
  description: string,
  splitMethod: SplitMethod,
  participants: string[],
  splitValues: bigint[] = []
): Promise<void> {
  await expenseManager
    .connect(payer)
    .addExpense(
      groupId,
      amount,
      description,
      splitMethod,
      participants,
      splitValues
    );
}

/**
 * @title mintTokens
 * @author Lorenzo Bandini
 * @param trustToken - The TrustToken contract instance
 * @param signer - The user minting the tokens
 * @param amount - The amount of Ether to send for minting
 */
export async function mintTokens(
  trustToken: TrustToken,
  signer: SignerWithAddress,
  amount: bigint
): Promise<void> {
  await trustToken.connect(signer).mint({ value: amount });
}

/**
 * @title approveTokens
 * @author Lorenzo Bandini
 * @param trustToken - The TrustToken contract instance
 * @param signer - The user approving the tokens
 * @param spender - The address allowed to spend the tokens
 * @param amount - The amount of tokens to approve
 */
export async function approveTokens(
  trustToken: TrustToken,
  signer: SignerWithAddress,
  spender: string,
  amount: bigint
): Promise<void> {
  await trustToken.connect(signer).approve(spender, amount);
}

/**
 * @param expenseManager - The ExpenseManager contract instance
 * @param signer - The user settling the debt
 * @param groupId - The ID of the group the debt belongs to
 * @param creditor - The address of the creditor
 * @param amount - The amount of debt to settle
 */
export async function settleDebt(
  expenseManager: ExpenseManager,
  signer: SignerWithAddress,
  groupId: number,
  creditor: string,
  amount: bigint
): Promise<void> {
  await expenseManager.connect(signer).settleDebt(groupId, creditor, amount);
}

/**
 * @title simplifyDebts
 * @author Lorenzo Bandini
 * @param debtSimplifier - The DebtSimplifier contract instance
 * @param signer - The user calling the simplification
 * @param groupId - The ID of the group to simplify debts for
 * @returns Arrays of new debtors, creditors, and amounts
 */
export async function simplifyDebts(
  debtSimplifier: DebtSimplifier,
  signer: SignerWithAddress,
  groupId: number
): Promise<[string[], string[], bigint[]]> {
  return await debtSimplifier.connect(signer).simplifyDebts(groupId);
}

/**
 * @title calculateNetBalance
 * @author Lorenzo Bandini
 * @param expenseManager - The ExpenseManager contract instance
 * @param groupId - The ID of the group
 * @param user - The user to calculate balance for
 * @param allMembers - All group members
 * @returns The net balance (positive = creditor, negative = debtor)
 */
export async function calculateNetBalance(
  expenseManager: ExpenseManager,
  groupId: number,
  user: string,
  allMembers: string[]
): Promise<bigint> {
  let balance = 0n;

  for (const member of allMembers) {
    if (member !== user) {
      const debt = await expenseManager.getDebt(groupId, user, member);
      const credit = await expenseManager.getDebt(groupId, member, user);
      balance += credit - debt;
    }
  }

  return balance;
}
