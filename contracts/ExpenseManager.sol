// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {GroupManager} from "./GroupManager.sol";
import {TrustToken} from "./TrustToken.sol";

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
    GroupManager public immutable GROUP_MANAGER;
    TrustToken public immutable TRUST_TOKEN;
    
    // Enum for different split methods
    enum SplitMethod { EQUAL, EXACT, PERCENTAGE }
    
    // Structure to store expense information
    struct Expense {
        uint32 groupId;
        address payer;
        uint256 amount;
        string description;
        uint48 timestamp;
        SplitMethod splitMethod;
        address[] participants;
        uint256[] splitValues;
    }
    
    // Mapping from expense ID to Expense struct
    mapping(uint256 => Expense) public expenses;
    
    // Counter for expense IDs
    uint64 private _expenseIdCounter;
    
    // Tracks how much a debtor owes a creditor within a specific group: groupId => debtor => creditor => amount
    mapping(uint32 => mapping(address => mapping(address => uint256))) public debts;
    
    // Events
    event ExpenseAdded(uint64 indexed expenseId, uint32 indexed groupId, address payer, uint256 amount);
    event DebtSettled(uint32 indexed groupId, address debtor, address creditor, uint256 amount);
    
    // Modifiers
    modifier onlyGroupMember(uint32 groupId) {
        require(GROUP_MANAGER.isGroupMember(groupId, msg.sender), "Not group member");
        _;
    }
    
    modifier validAmount(uint256 amount) {
        require(amount > 0, "Invalid amount");
        _;
    }
    
    modifier validAddress(address addr) {
        require(addr != address(0), "Invalid address");
        _;
    }
    
    constructor(address _groupManager, address _trustToken) {
        GROUP_MANAGER = GroupManager(_groupManager);
        TRUST_TOKEN = TrustToken(_trustToken);
    }
    
    /**
     * @notice Adds a new expense to a group
     * @param groupId The ID of the group
     * @param amount The total amount of the expense
     * @param description Description of the expense
     * @param splitMethod The method to split the expense
     * @param participants Array of addresses involved in the expense
     * @param splitValues Array of values for splitting (amounts or percentages)
     */
    function addExpense(
        uint32 groupId,
        uint256 amount,
        string memory description,
        SplitMethod splitMethod,
        address[] memory participants,
        uint256[] memory splitValues
    ) external onlyGroupMember(groupId) validAmount(amount) {
        require(participants.length > 0, "No participants");
        
        // Verify all participants are group members
        for (uint16 i = 0; i < participants.length; i++) {
            require(GROUP_MANAGER.isGroupMember(groupId, participants[i]), "Invalid participant");
        }
        
        // Verify split values based on method
        if (splitMethod == SplitMethod.EQUAL) {
            require(splitValues.length == 0, "No split values needed");
        } else if (splitMethod == SplitMethod.EXACT) {
            require(participants.length == splitValues.length, "Length mismatch");
            uint256 total = 0;
            for (uint16 i = 0; i < splitValues.length; i++) {
                total += splitValues[i];
            }
            require(total == amount, "Split sum mismatch");
        } else if (splitMethod == SplitMethod.PERCENTAGE) {
            require(participants.length == splitValues.length, "Length mismatch");
            uint256 total = 0;
            for (uint16 i = 0; i < splitValues.length; i++) {
                require(splitValues[i] <= 100, "Invalid percentage");
                total += splitValues[i];
            }
            require(total == 100, "Percentage sum != 100");
        }
        
        // Create new expense
        uint64 expenseId = _expenseIdCounter++;
        expenses[expenseId] = Expense({
            groupId: groupId,
            payer: msg.sender,
            amount: amount,
            description: description,
            timestamp: uint48(block.timestamp),
            splitMethod: splitMethod,
            participants: participants,
            splitValues: splitValues
        });
        
        // Calculate and update debts
        _updateDebts(expenseId);
        
        emit ExpenseAdded(expenseId, groupId, msg.sender, amount);
    }
    
    /**
     * @notice Settles a debt between two users using TRUST tokens
     * @param groupId The ID of the group
     * @param creditor The address of the creditor
     * @param amount The amount to settle
     */
    function settleDebt(uint32 groupId, address creditor, uint256 amount) external onlyGroupMember(groupId) validAddress(creditor) validAmount(amount) {
        require(GROUP_MANAGER.isGroupMember(groupId, creditor), "Creditor not in group");
        require(msg.sender != creditor, "Cannot pay yourself");
        require(debts[groupId][msg.sender][creditor] >= amount, "Insufficient debt");
        
        // Transfer tokens from debtor to creditor
        require(TRUST_TOKEN.transferFrom(msg.sender, creditor, amount), "Transfer failed");
        
        // Update debt
        debts[groupId][msg.sender][creditor] -= amount;
        
        emit DebtSettled(groupId, msg.sender, creditor, amount);
    }
    
    /**
     * @notice Updates the debt graph based on a new expense
     * @param expenseId The ID of the expense
     */
    function _updateDebts(uint64 expenseId) private {
        Expense storage expense = expenses[expenseId];
        uint32 groupId = expense.groupId;
        address payer = expense.payer;
        
        if (expense.splitMethod == SplitMethod.EQUAL) {
            uint256 share = expense.amount / expense.participants.length;
            for (uint16 i = 0; i < expense.participants.length; i++) {
                address participant = expense.participants[i];
                if (participant != payer) {
                    debts[groupId][participant][payer] += share;
                }
            }
        } else if (expense.splitMethod == SplitMethod.EXACT) {
            for (uint16 i = 0; i < expense.participants.length; i++) {
                address participant = expense.participants[i];
                if (participant != payer) {
                    debts[groupId][participant][payer] += expense.splitValues[i];
                }
            }
        } else if (expense.splitMethod == SplitMethod.PERCENTAGE) {
            for (uint16 i = 0; i < expense.participants.length; i++) {
                address participant = expense.participants[i];
                if (participant != payer) {
                    uint256 share = (expense.amount * expense.splitValues[i]) / 100;
                    debts[groupId][participant][payer] += share;
                }
            }
        }
    }
    
    /**
     * @notice Returns the debt amount between two users in a group
     * @param groupId The ID of the group
     * @param debtor The address of the debtor
     * @param creditor The address of the creditor
     * @return The amount of debt
     */
    function getDebt(uint32 groupId, address debtor, address creditor) external view returns (uint256) {
        return debts[groupId][debtor][creditor];
    }
}
