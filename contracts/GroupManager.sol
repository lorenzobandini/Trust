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
 */
contract GroupManager {
    // Maximum number of members allowed in a group
    uint256 public constant MAX_GROUP_SIZE = 50;
    
    // Structure to store group information
    struct Group {
        string name;
        address creator;
        address[] members;
        bool exists;
    }
    
    // Mapping from group ID to Group struct
    mapping(uint256 => Group) public groups;
    
    // Counter for group IDs
    uint256 private _groupIdCounter;
    
    // Mapping to track if an address is a member of a group
    mapping(uint256 => mapping(address => bool)) public isGroupMember;

    // Events
    event GroupCreated(uint256 indexed groupId, string name, address creator);
    event MemberJoined(uint256 indexed groupId, address member);
    
    /**
     * @notice Creates a new group with the given name and initial members
     * @param name The name of the group
     * @param initialMembers Array of addresses to be added as initial members
     * @return groupId The ID of the newly created group
     */
    function createGroup(string memory name, address[] memory initialMembers) external returns (uint256) {
        require(bytes(name).length > 0, "Group name cannot be empty");
        require(bytes(name).length <= 32, "Group name too long");
        require(initialMembers.length < MAX_GROUP_SIZE, "Too many initial members");
        
        uint256 groupId = _groupIdCounter++;
        
        // Create new group
        Group storage newGroup = groups[groupId];
        newGroup.name = name;
        newGroup.creator = msg.sender;
        newGroup.exists = true;
        
        // Add creator as first member
        newGroup.members.push(msg.sender);
        isGroupMember[groupId][msg.sender] = true;

        // Add initial members, uint8 because we know the length is less than 50
        for (uint8 i = 0; i < initialMembers.length; i++) {
            address member = initialMembers[i];
            require(member != address(0), "Invalid member address");
            require(!isGroupMember[groupId][member], "Member already in group");
            require(member != msg.sender, "Creator cannot be added as initial member");
            
            newGroup.members.push(member);
            isGroupMember[groupId][member] = true;
        }
        
        emit GroupCreated(groupId, name, msg.sender);
        return groupId;
    }
    
    /**
     * @notice Allows a user to join an existing group
     * @param groupId The ID of the group to join
     */
    function joinGroup(uint256 groupId) external {
        Group storage group = groups[groupId];
        require(group.exists, "Group does not exist");
        require(!isGroupMember[groupId][msg.sender], "Already a member");
        require(group.members.length < MAX_GROUP_SIZE, "Group is full");
        
        group.members.push(msg.sender);
        isGroupMember[groupId][msg.sender] = true;
        
        emit MemberJoined(groupId, msg.sender);
    }
    
    /**
     * @notice Returns the list of members in a group
     * @param groupId The ID of the group
     * @return Array of member addresses
     */
    function getGroupMembers(uint256 groupId) external view returns (address[] memory) {
        require(groups[groupId].exists, "Group does not exist");
        return groups[groupId].members;
    }
    
    /**
     * @notice Returns the total number of groups created
     * @return The number of groups
     */
    function getGroupCount() external view returns (uint256) {
        return _groupIdCounter;
    }


    //TODO: function to allow users to leave a group, only if all debts are settled


    //TODO: function to delete a group, only by the creator and if all debts are settled


    //TODO: function to get group details, including name, creator, and member count so we can display it in the UI and allow users to search for groups
}
