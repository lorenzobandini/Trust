// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrustToken
 * @author Lorenzo Bandini
 * @notice ERC-20 token used for debt payments in the TRUST system.
 * @dev Supports token minting with Ether and transfers between users for debt settlement.
 * 
 * Functionalities:
 * - Token minting: users can mint tokens at a fixed Ether rate.
 * - Payment mechanism: tokens are transferred to settle debts, triggering state updates.
 */
contract TrustToken is ERC20, Ownable {
    // Rate of tokens per Ether (1 ETH = 1000 TRUST tokens)
    // TODO: Synchronize the change with the actual value of Ether
    uint16 public constant MINT_RATE = 1000;
    
    // Modifiers
    modifier validAmount(uint256 amount) {
        require(amount > 0, "Invalid amount");
        _;
    }
    
    // Event emitted when tokens are minted
    event TokensMinted(address indexed to, uint128 amount, uint128 ethAmount);
    
    constructor() ERC20("TRUST Token", "TRUST") Ownable(msg.sender) {}
    
    /**
     * @notice Mints new tokens in exchange for Ether
     * @dev The amount of tokens minted is calculated based on the MINT_RATE
     */
    function mint() external payable validAmount(msg.value) {
        uint256 tokenAmountFull = msg.value * MINT_RATE;
        require(tokenAmountFull <= type(uint128).max, "Mint limit exceeded");
        uint128 tokenAmount = uint128(tokenAmountFull);
        
        _mint(msg.sender, tokenAmount);
        
        emit TokensMinted(msg.sender, tokenAmount, uint128(msg.value));
    }
    
    /**
     * @notice Allows the contract owner to withdraw accumulated Ether
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance <= type(uint128).max, "Balance limit exceeded");
        uint128 safeBalance = uint128(balance);
        require(safeBalance > 0, "No Ether");
        
        (bool success, ) = owner().call{value: safeBalance}("");
        require(success, "Withdrawal failed");
    }

    // TODO: function to allow users to redeem tokens for Ether, all must be syncronized with the change in the state of the system
}
