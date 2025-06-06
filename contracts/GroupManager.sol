// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/**
 * @title GroupManager
 * @author Lorenzo Bandini
 * @notice Handles group creation and user membership for TRUST.
 * @dev Stores groups and their members. Ensures no duplicates and enforces a max member limit per group.
 * 
 * Functionalities:
 * - Group creation: allows a user to create a new group with an initial list of members.
 * - Group joining: users can join existing groups if not already members and within size limits.
 * - Group leaving: allows users to leave groups if all their debts are settled.
 * - Group deletion: allows group creators to delete groups if all debts are settled.
 */

interface IExpenseManager {
    function getDebt(uint32 groupId, address debtor, address creditor) external view returns (uint256);
    function initializeGroupBalances(uint32 groupId, address[] memory members) external;
}

contract GroupManager {
    // Maximum number of members allowed in a group
    uint16 public constant MAX_GROUP_SIZE = 50;
    
    // Reference to the ExpenseManager contract
    IExpenseManager public expenseManager;
    
    // Address of the contract owner (for access control)
    address public immutable OWNER;
    
    // Structure to store group information
    struct Group {
        string name;
        address creator;
        address[] members;
        bool exists;
    }
    
    // Mapping from group ID to Group struct
    mapping(uint32 => Group) public groups;
    
    // Counter for group IDs
    uint32 private _groupIdCounter;
    
    // Mapping to track if an address is a member of a group
    mapping(uint32 => mapping(address => bool)) public isGroupMember;

    // Events
    event GroupCreated(uint32 indexed groupId, string name, address creator);
    event MemberJoined(uint32 indexed groupId, address member);
    event MemberLeft(uint32 indexed groupId, address member);
    event GroupDeleted(uint32 indexed groupId, address creator);
    
    // Modifiers
    modifier groupExists(uint32 groupId) {
        require(groups[groupId].exists, "Group not found");
        _;
    }
    
    modifier onlyGroupMember(uint32 groupId) {
        require(isGroupMember[groupId][msg.sender], "Not group member");
        _;
    }
    
    modifier onlyGroupCreator(uint32 groupId) {
        require(groups[groupId].creator == msg.sender, "Not group creator");
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
    
    constructor() {
        OWNER = msg.sender;
    }
    
    /**
     * @notice Sets the ExpenseManager contract address
     * @param _expenseManager Address of the ExpenseManager contract
     */
    function setExpenseManager(address _expenseManager) external onlyOwner validAddress(_expenseManager) {
        require(address(expenseManager) == address(0), "Already set");
        expenseManager = IExpenseManager(_expenseManager);
    }
    
    /**
     * @notice Creates a new group with the given name and initial members
     * @param name The name of the group
     * @param initialMembers Array of addresses to be added as initial members
     * @return groupId The ID of the newly created group
     */
    function createGroup(string memory name, address[] memory initialMembers) external returns (uint32) {
        require(bytes(name).length > 0, "Empty name");
        require(bytes(name).length <= 32, "Name too long");
        require(initialMembers.length < MAX_GROUP_SIZE, "Too many members");
        
        uint32 groupId = _groupIdCounter++;
        
        // Create new group
        Group storage newGroup = groups[groupId];
        newGroup.name = name;
        newGroup.creator = msg.sender;
        newGroup.exists = true;
        
        // Add creator as first member
        newGroup.members.push(msg.sender);
        isGroupMember[groupId][msg.sender] = true;

        // Add initial members
        for (uint8 i = 0; i < initialMembers.length; i++) {
            address member = initialMembers[i];
            require(member != address(0), "Invalid member");
            require(!isGroupMember[groupId][member], "Member exists");
            require(member != msg.sender, "Creator auto-added");
            
            newGroup.members.push(member);
            isGroupMember[groupId][member] = true;
        }
        
        // Initialize balances for all group members if ExpenseManager is set
        if (address(expenseManager) != address(0)) {
            address[] memory allMembers = newGroup.members;
            expenseManager.initializeGroupBalances(groupId, allMembers);
        }
        
        emit GroupCreated(groupId, name, msg.sender);
        return groupId;
    }
    
    /**
     * @notice Allows a user to join an existing group
     * @param groupId The ID of the group to join
     */
    function joinGroup(uint32 groupId) external groupExists(groupId) {
        require(!isGroupMember[groupId][msg.sender], "Already a member");
        require(groups[groupId].members.length < MAX_GROUP_SIZE, "Group is full");
        
        groups[groupId].members.push(msg.sender);
        isGroupMember[groupId][msg.sender] = true;
        
        emit MemberJoined(groupId, msg.sender);
    }
    
    /**
     * @notice Returns the list of members in a group
     * @param groupId The ID of the group
     * @return Array of member addresses
     */
    function getGroupMembers(uint32 groupId) external view groupExists(groupId) returns (address[] memory) {
        return groups[groupId].members;
    }
    
    /**
     * @notice Returns the total number of groups created
     * @return The number of groups
     */
    function getGroupCount() external view returns (uint32) {
        return _groupIdCounter;
    }

    /**
     * @notice Allows a user to leave a group, only if all debts are settled
     * @param groupId The ID of the group to leave
     */
    function leaveGroup(uint32 groupId) external groupExists(groupId) onlyGroupMember(groupId) {
        require(groups[groupId].creator != msg.sender, "Creator use deleteGroup");
        
        // Check if ExpenseManager is set before checking debts
        if (address(expenseManager) != address(0)) {
            // Verify that the user has no outstanding debts
            address[] memory groupMembers = groups[groupId].members;
            for (uint16 i = 0; i < groupMembers.length; i++) {
                address member = groupMembers[i];
                if (member != msg.sender) {
                    require(expenseManager.getDebt(groupId, msg.sender, member) == 0, "Has debts");
                    require(expenseManager.getDebt(groupId, member, msg.sender) == 0, "Has credits");
                }
            }
        }
        
        // Remove user from group members array
        address[] storage members = groups[groupId].members;
        for (uint16 i = 0; i < members.length; i++) {
            if (members[i] == msg.sender) {
                // Replace with last element and pop
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }
        
        // Update membership mapping
        isGroupMember[groupId][msg.sender] = false;
        
        emit MemberLeft(groupId, msg.sender);
    }

    /**
     * @notice Deletes a group, only by the creator and if all debts are settled
     * @param groupId The ID of the group to delete
     */
    function deleteGroup(uint32 groupId) external groupExists(groupId) onlyGroupCreator(groupId) {
        // Check if ExpenseManager is set before checking debts
        if (address(expenseManager) != address(0)) {
            // Verify that no debts exist between any group members
            address[] memory groupMembers = groups[groupId].members;
            for (uint16 i = 0; i < groupMembers.length; i++) {
                for (uint16 j = 0; j < groupMembers.length; j++) {
                    if (i != j) {
                        require(expenseManager.getDebt(groupId, groupMembers[i], groupMembers[j]) == 0, "Has debts");
                    }
                }
            }
        }
        
        // Clear group members mapping
        address[] memory membersToRemove = groups[groupId].members;
        for (uint16 i = 0; i < membersToRemove.length; i++) {
            isGroupMember[groupId][membersToRemove[i]] = false;
        }
        
        // Mark group as non-existent
        groups[groupId].exists = false;
        
        emit GroupDeleted(groupId, msg.sender);
    }
}
