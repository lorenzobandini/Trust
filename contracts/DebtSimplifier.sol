// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

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
    GroupManager public immutable GROUP_MANAGER;
    ExpenseManager public immutable EXPENSE_MANAGER;
    
    // Structure to store user balance information
    struct UserBalance {
        address user;
        int256 balance;
    }
    
    // Events
    event DebtSimplified(uint32 indexed groupId, uint16 originalEdgeCount, uint16 newEdgeCount);
    
    // Modifiers
    modifier onlyGroupMember(uint32 groupId) {
        require(GROUP_MANAGER.isGroupMember(groupId, msg.sender), "Not group member");
        _;
    }
    
    modifier validAddress(address addr) {
        require(addr != address(0), "Invalid address");
        _;
    }
    
    constructor(address _groupManager, address _expenseManager) {
        require(_groupManager != address(0), "Invalid GroupManager");
        require(_expenseManager != address(0), "Invalid ExpenseManager");
        
        GROUP_MANAGER = GroupManager(_groupManager);
        EXPENSE_MANAGER = ExpenseManager(_expenseManager);
    }

    /**
     * @notice Simplifies the debt graph for a group using the greedy algorithm
     * @param groupId The ID of the group to simplify debts for
     * @return newDebtors Array of new debtors
     * @return newCreditors Array of new creditors
     * @return newAmounts Array of new debt amounts
     */
    function simplifyDebts(uint32 groupId) external onlyGroupMember(groupId) returns (
        address[] memory newDebtors,
        address[] memory newCreditors,
        uint256[] memory newAmounts
    ) {
        // Get all group members
        address[] memory members = GROUP_MANAGER.getGroupMembers(groupId);
        
        // Get initial balances
        UserBalance[] memory balances = _getInitialBalancesFromManager(groupId, members);
        
        // Count original edges for event and split creditors/debtors
        (uint16 originalEdgeCount, UserBalance[] memory creditors, UserBalance[] memory debtors, uint16 creditorCount, uint16 debtorCount) = _processBalances(groupId, members, balances);
        
        // Sort creditors and debtors by balance using HeapSort
        _heapSort(creditors, creditorCount);
        _heapSort(debtors, debtorCount);
        
        // Generate new debt edges using greedy algorithm
        (newDebtors, newCreditors, newAmounts) = _generateSimplifiedDebts(members, creditors, debtors, creditorCount, debtorCount);
        
        // Update the expense manager with simplified debts
        _updateExpenseManager(groupId, members, newDebtors, newCreditors, newAmounts);
        
        emit DebtSimplified(groupId, originalEdgeCount, uint16(newDebtors.length));
        
        return (newDebtors, newCreditors, newAmounts);
    }
    
    /**
     * @notice Sorts an array of UserBalance by absolute balance using HeapSort (O(N log N))
     * @param balances Array to sort (in-place)
     * @param length Length of the array to sort
     */
    function _heapSort(UserBalance[] memory balances, uint16 length) private pure {
        if (length <= 1) return;
        
        // Build heap (rearrange array)
        for (int16 i = int16(length) / 2 - 1; i >= 0; i--) {
            _heapify(balances, length, uint16(i));
        }
        
        // One by one extract an element from heap
        for (uint16 i = length - 1; i > 0; i--) {
            // Move current root to end
            UserBalance memory temp = balances[0];
            balances[0] = balances[i];
            balances[i] = temp;
            
            // Call heapify on the reduced heap
            _heapify(balances, i, 0);
        }
    }
    
    /**
     * @notice Heapify a subtree rooted with node i which is an index in balances[]
     * @param balances Array to heapify
     * @param n Size of heap
     * @param i Root index
     */
    function _heapify(UserBalance[] memory balances, uint16 n, uint16 i) private pure {
        uint16 largest = i; // Initialize largest as root
        uint16 left = 2 * i + 1; // left = 2*i + 1
        uint16 right = 2 * i + 2; // right = 2*i + 2
        
        // If left child is larger than root
        if (left < n && abs(balances[left].balance) > abs(balances[largest].balance)) {
            largest = left;
        }
        
        // If right child is larger than largest so far
        if (right < n && abs(balances[right].balance) > abs(balances[largest].balance)) {
            largest = right;
        }
        
        // If largest is not root
        if (largest != i) {
            UserBalance memory temp = balances[i];
            balances[i] = balances[largest];
            balances[largest] = temp;
            
            // Recursively heapify the affected sub-tree
            _heapify(balances, n, largest);
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
    
    /**
     * @notice Gets initial balances efficiently using O(N) approach from ExpenseManager
     * @param groupId The ID of the group
     * @param members Array of group member addresses
     * @return balances Array of UserBalance structs
     */
    function _getInitialBalancesFromManager(uint32 groupId, address[] memory members) private view returns (UserBalance[] memory) {
        UserBalance[] memory balances = new UserBalance[](members.length);
        
        for (uint16 i = 0; i < members.length; i++) {
            balances[i].user = members[i];
            balances[i].balance = EXPENSE_MANAGER.getNetBalance(groupId, members[i]);
        }
        
        return balances;
    }
    
    /**
     * @notice Counts the current number of debt edges in the graph
     * @param groupId The ID of the group
     * @param members Array of group member addresses
     * @return edgeCount Number of non-zero debt edges
     */
    function _countCurrentEdges(uint32 groupId, address[] memory members) private view returns (uint16) {
        uint16 edgeCount = 0;
        
        for (uint16 i = 0; i < members.length; i++) {
            for (uint16 j = 0; j < members.length; j++) {
                if (i != j && EXPENSE_MANAGER.getDebt(groupId, members[i], members[j]) > 0) {
                    edgeCount++;
                }
            }
        }
        
        return edgeCount;
    }
    
    /**
     * @notice Processes balances and separates creditors/debtors
     * @param groupId The ID of the group
     * @param members Array of group member addresses
     * @param balances Array of UserBalance structs
     * @return originalEdgeCount Number of original debt edges
     * @return creditors Array of creditors
     * @return debtors Array of debtors
     * @return creditorCount Number of creditors
     * @return debtorCount Number of debtors
     */
    function _processBalances(uint32 groupId, address[] memory members, UserBalance[] memory balances) private view returns (
        uint16 originalEdgeCount,
        UserBalance[] memory creditors,
        UserBalance[] memory debtors,
        uint16 creditorCount,
        uint16 debtorCount
    ) {
        // Count original edges
        originalEdgeCount = _countCurrentEdges(groupId, members);
        
        // Initialize arrays
        creditors = new UserBalance[](members.length);
        debtors = new UserBalance[](members.length);
        creditorCount = 0;
        debtorCount = 0;
        
        // Classify users into creditors and debtors
        for (uint16 i = 0; i < balances.length; i++) {
            if (balances[i].balance > 0) {
                creditors[creditorCount++] = balances[i];
            } else if (balances[i].balance < 0) {
                debtors[debtorCount++] = balances[i];
            }
        }
    }
    
    /**
     * @notice Generates simplified debts using greedy algorithm
     * @param members Array of group member addresses
     * @param creditors Array of creditors
     * @param debtors Array of debtors
     * @param creditorCount Number of creditors
     * @param debtorCount Number of debtors
     * @return newDebtors Array of new debtors
     * @return newCreditors Array of new creditors
     * @return newAmounts Array of new debt amounts
     */
    function _generateSimplifiedDebts(
        address[] memory members,
        UserBalance[] memory creditors,
        UserBalance[] memory debtors,
        uint16 creditorCount,
        uint16 debtorCount
    ) private pure returns (
        address[] memory newDebtors,
        address[] memory newCreditors,
        uint256[] memory newAmounts
    ) {
        // Initialize arrays
        newDebtors = new address[](members.length);
        newCreditors = new address[](members.length);
        newAmounts = new uint256[](members.length);
        uint16 edgeCount = 0;
        
        uint16 creditorIndex = 0;
        uint16 debtorIndex = 0;
        
        // Greedy matching algorithm
        while (creditorIndex < creditorCount && debtorIndex < debtorCount) {
            uint256 creditorAmount = abs(creditors[creditorIndex].balance);
            uint256 debtorAmount = abs(debtors[debtorIndex].balance);
            uint256 amount = min(creditorAmount, debtorAmount);
            
            if (amount > 0) {
                newDebtors[edgeCount] = debtors[debtorIndex].user;
                newCreditors[edgeCount] = creditors[creditorIndex].user;
                newAmounts[edgeCount] = amount;
                edgeCount++;
                
                creditors[creditorIndex].balance -= int256(amount);
                debtors[debtorIndex].balance += int256(amount);
                
                if (creditors[creditorIndex].balance == 0) creditorIndex++;
                if (debtors[debtorIndex].balance == 0) debtorIndex++;
            } else {
                creditorIndex++;
                debtorIndex++;
            }
        }
        
        // Resize arrays
        assembly {
            mstore(newDebtors, edgeCount)
            mstore(newCreditors, edgeCount)
            mstore(newAmounts, edgeCount)
        }
    }
    
    /**
     * @notice Updates the expense manager with simplified debts
     * @param groupId The ID of the group
     * @param members Array of group member addresses
     * @param newDebtors Array of new debtors
     * @param newCreditors Array of new creditors
     * @param newAmounts Array of new debt amounts
     */
    function _updateExpenseManager(
        uint32 groupId,
        address[] memory members,
        address[] memory newDebtors,
        address[] memory newCreditors,
        uint256[] memory newAmounts
    ) private {
        // Clear current debts
        EXPENSE_MANAGER.clearDebtsAndBalancesForGroup(groupId, members);
        
        // Record simplified debts
        for (uint16 i = 0; i < newDebtors.length; i++) {
            EXPENSE_MANAGER.recordSimplifiedDebt(groupId, newDebtors[i], newCreditors[i], newAmounts[i]);
        }
    }
}
