// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/**
 * @title ExpenseManager
 * @author Lorenzo Bandini
 * @notice Manages expense tracking and debt registration in TRUST.
 * @dev Allows group members to record expenses and updates internal debt mappings accordingly.
 * 
 * Functionalities:
 * - Expense addition: input includes payer, amount, date, description, and split logic (equal, exact, %).
 * - Debt recording: calculates how much each participant owes and updates internal debts.
 * - Payment settlement: handles token-based payments and adjusts the debt graph.
 */
contract ExpenseManager {
    // TODO: to be implemented
}
