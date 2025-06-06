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
    
    // Address of the contract owner (for access control)
    address public immutable OWNER;
    
    // Address of the DebtSimplifier contract
    address public debtSimplifierContract;
    
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
    
    // Tracks net balances for each user in each group (positive = creditor, negative = debtor)
    mapping(uint32 => mapping(address => int256)) public groupUserNetBalances;
    
    // Events
    event ExpenseAdded(uint64 indexed expenseId, uint32 indexed groupId, address payer, uint256 amount);
    event DebtSettled(uint32 indexed groupId, address debtor, address creditor, uint256 amount);
    event DebtSimplifierSet(address indexed debtSimplifier);
    event DebtsCleared(uint32 indexed groupId);
    event SimplifiedDebtRecorded(uint32 indexed groupId, address debtor, address creditor, uint256 amount);
    
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
    
    modifier onlyOwner() {
        require(msg.sender == OWNER, "Not owner");
        _;
    }
    
    modifier onlyDebtSimplifier() {
        require(msg.sender == debtSimplifierContract, "Not debt simplifier");
        _;
    }
    
    constructor(address _groupManager, address _trustToken) {
        GROUP_MANAGER = GroupManager(_groupManager);
        TRUST_TOKEN = TrustToken(_trustToken);
        OWNER = msg.sender;
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
        
        // Update net balances
        groupUserNetBalances[groupId][msg.sender] += int256(amount);
        groupUserNetBalances[groupId][creditor] -= int256(amount);

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
            
            // Update payer's net balance 
            groupUserNetBalances[groupId][payer] += int256(expense.amount);
            
            for (uint16 i = 0; i < expense.participants.length; i++) {
                address participant = expense.participants[i];
                
                // Update participant's net balance (they owe their share)
                groupUserNetBalances[groupId][participant] -= int256(share);
                
                if (participant != payer) {
                    debts[groupId][participant][payer] += share;
                }
            }
        } else if (expense.splitMethod == SplitMethod.EXACT) {
            // Update payer's net balance
            groupUserNetBalances[groupId][payer] += int256(expense.amount);
            
            for (uint16 i = 0; i < expense.participants.length; i++) {
                address participant = expense.participants[i];
                uint256 amount = expense.splitValues[i];
                
                // Update participant's net balance
                groupUserNetBalances[groupId][participant] -= int256(amount);
                
                if (participant != payer) {
                    debts[groupId][participant][payer] += amount;
                }
            }
        } else if (expense.splitMethod == SplitMethod.PERCENTAGE) {
            // Update payer's net balance
            groupUserNetBalances[groupId][payer] += int256(expense.amount);
            
            for (uint16 i = 0; i < expense.participants.length; i++) {
                address participant = expense.participants[i];
                uint256 share = (expense.amount * expense.splitValues[i]) / 100;
                
                // Update participant's net balance
                groupUserNetBalances[groupId][participant] -= int256(share);
                
                if (participant != payer) {
                    debts[groupId][participant][payer] += share;
                }
            }
        }
    }
    
    /**
     * @notice Sets the DebtSimplifier contract address
     * @param _debtSimplifier Address of the DebtSimplifier contract
     */
    function setDebtSimplifierContract(address _debtSimplifier) external onlyOwner validAddress(_debtSimplifier) {
        require(debtSimplifierContract == address(0), "Already set");
        debtSimplifierContract = _debtSimplifier;
        emit DebtSimplifierSet(_debtSimplifier);
    }
    
    /**
     * @notice Returns the net balance for a user in a group
     * @param groupId The ID of the group
     * @param user The address of the user
     * @return The net balance (positive = creditor, negative = debtor)
     */
    function getNetBalance(uint32 groupId, address user) external view returns (int256) {
        return groupUserNetBalances[groupId][user];
    }
    
    /**
     * @notice Initializes net balances for all group members to 0
     * @param groupId The ID of the group
     * @param members Array of group member addresses
     */
    function initializeGroupBalances(uint32 groupId, address[] memory members) external {
        require(msg.sender == address(GROUP_MANAGER), "Only GroupManager");
        
        for (uint16 i = 0; i < members.length; i++) {
            groupUserNetBalances[groupId][members[i]] = 0;
        }
    }
    
    /**
     * @notice Clears all debts and balances for a group (used by DebtSimplifier)
     * @param groupId The ID of the group
     * @param members Array of group member addresses
     */
    function clearDebtsAndBalancesForGroup(uint32 groupId, address[] memory members) external onlyDebtSimplifier {
        // Clear all pairwise debts
        for (uint16 i = 0; i < members.length; i++) {
            for (uint16 j = 0; j < members.length; j++) {
                if (i != j) {
                    debts[groupId][members[i]][members[j]] = 0;
                }
            }
        }
        
        emit DebtsCleared(groupId);
    }
    
    /**
     * @notice Records a simplified debt (used by DebtSimplifier)
     * @param groupId The ID of the group
     * @param debtor The address of the debtor
     * @param creditor The address of the creditor
     * @param amount The debt amount
     */
    function recordSimplifiedDebt(uint32 groupId, address debtor, address creditor, uint256 amount) external onlyDebtSimplifier {
        debts[groupId][debtor][creditor] = amount;
        emit SimplifiedDebtRecorded(groupId, debtor, creditor, amount);
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
