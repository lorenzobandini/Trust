// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { GroupManager } from "./GroupManager.sol";
import { ExpenseManager } from "./ExpenseManager.sol";

/**
 * @title DebtSimplifier
 * @author Lorenzo Bandini
 * @notice Applies a greedy simplification algorithm to minimize debt edges in the graph.
 * @dev Operates on participant balances and rewrites the debt graph by matching creditors and debtors.
 * 
 * Functionalities:
 * - Computes net balances per user.
 * - Matches the largest debtor with the largest creditor iteratively.
 * - Produces a simplified version of the debt graph with fewer edges.
 */
contract DebtSimplifier {
    GroupManager public immutable groupManager;
    ExpenseManager public immutable expenseManager;
    
    // Structure to store user balance information
    struct UserBalance {
        address user;
        int256 balance;
    }
    
    // Events
    event DebtSimplified(uint32 indexed groupId, uint16 originalEdgeCount, uint16 newEdgeCount);
    
    constructor(address _groupManager, address _expenseManager) {
        groupManager = GroupManager(_groupManager);
        expenseManager = ExpenseManager(_expenseManager);
    }
    
    // TODO: naming convention groupManager → GROUP_MANAGER, expenseManager → EXPENSE_MANAGER
    // Constructor with address validation
    // Modifier for "Not group member"

    /**
     * @notice Simplifies the debt graph for a group using the greedy algorithm
     * @param groupId The ID of the group to simplify debts for
     * @return newDebtors Array of new debtors
     * @return newCreditors Array of new creditors
     * @return newAmounts Array of new debt amounts
     */
    function simplifyDebts(uint32 groupId) external view returns (
        address[] memory newDebtors,
        address[] memory newCreditors,
        uint256[] memory newAmounts
    ) {
        require(groupManager.isGroupMember(groupId, msg.sender), "Not group member");
        
        // Get all group members
        address[] memory members = groupManager.getGroupMembers(groupId);
        
        // Initialize balances for each member
        UserBalance[] memory balances = new UserBalance[](members.length);
        for (uint16 i = 0; i < members.length; i++) {
            balances[i].user = members[i];
            balances[i].balance = 0;
        }
        
        // Calculate net balances
        for (uint16 i = 0; i < members.length; i++) {
            address member = members[i];
            for (uint16 j = 0; j < members.length; j++) {
                if (i != j) {
                    address other = members[j];
                    uint256 debt = expenseManager.getDebt(groupId, member, other);
                    uint256 credit = expenseManager.getDebt(groupId, other, member);
                    balances[i].balance += int256(credit) - int256(debt);
                }
            }
        }
        
        // Separate creditors and debtors
        UserBalance[] memory creditors = new UserBalance[](members.length);
        UserBalance[] memory debtors = new UserBalance[](members.length);
        uint16 creditorCount = 0;
        uint16 debtorCount = 0;
        
        // Classify users into creditors and debtors
        for (uint16 i = 0; i < balances.length; i++) {
            if (balances[i].balance > 0) {
                creditors[creditorCount++] = balances[i];
            } else if (balances[i].balance < 0) {
                debtors[debtorCount++] = balances[i];
            }
        }
        
        // Sort creditors and debtors by balance
        _sortByAbsoluteBalance(creditors, creditorCount);
        _sortByAbsoluteBalance(debtors, debtorCount);
        
        // Arrays to store new debt edges
        newDebtors = new address[](members.length);
        newCreditors = new address[](members.length);
        newAmounts = new uint256[](members.length);
        uint16 edgeCount = 0;
        
        uint16 creditorIndex = 0;
        uint16 debtorIndex = 0;
        
        // Greedy matching algorithm that iteratively matches debtors with creditors
        while (creditorIndex < creditorCount && debtorIndex < debtorCount) {
            uint256 creditorAmount = abs(creditors[creditorIndex].balance);
            uint256 debtorAmount = abs(debtors[debtorIndex].balance);
            uint256 amount = min(creditorAmount, debtorAmount);
            
            if (amount > 0) {
                // Register a new edge from debtor to creditor
                newDebtors[edgeCount] = debtors[debtorIndex].user;
                newCreditors[edgeCount] = creditors[creditorIndex].user;
                newAmounts[edgeCount] = amount;
                edgeCount++;
                
                // Update balances directly in arrays
                creditors[creditorIndex].balance -= int256(amount);
                debtors[debtorIndex].balance += int256(amount);
                
                // Only increment indices if balances are zero
                if (creditors[creditorIndex].balance == 0) creditorIndex++;
                if (debtors[debtorIndex].balance == 0) debtorIndex++;
            } else {
                creditorIndex++;
                debtorIndex++;
            }
        }
        
        // Resize arrays to actual size
        assembly {
            mstore(newDebtors, edgeCount)
            mstore(newCreditors, edgeCount)
            mstore(newAmounts, edgeCount)
        }
        
        return (newDebtors, newCreditors, newAmounts);
    }
    
    /**
     * @notice Sorts an array of UserBalance by absolute balance using insertion sort
     * @param balances Array to sort
     * @param length Length of the array
     */
    function _sortByAbsoluteBalance(UserBalance[] memory balances, uint16 length) private pure {
        for (uint16 i = 1; i < length; i++) {
            UserBalance memory key = balances[i];
            uint16 j = i;
            
            while (j > 0 && abs(balances[j - 1].balance) < abs(key.balance)) {
                balances[j] = balances[j - 1];
                j--;
            }
            
            balances[j] = key;
        }
    }
    
    /**
     * @notice Returns the absolute value of an int256
     * @param x The number to get absolute value of
     * @return The absolute value
     */
    function abs(int256 x) private pure returns (uint256) {
        return uint256(x >= 0 ? x : -x);
    }
    
    /**
     * @notice Returns the minimum of two uint256 values
     * @param a First value
     * @param b Second value
     * @return The minimum value
     */
    function min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
