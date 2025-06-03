// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
    uint256 public constant MINT_RATE = 1000;
    
    // Event emitted when tokens are minted
    event TokensMinted(address indexed to, uint256 amount, uint256 ethAmount);
    
    constructor() ERC20("TRUST Token", "TRUST") Ownable(msg.sender) {}
    
    /**
     * @notice Mints new tokens in exchange for Ether
     * @dev The amount of tokens minted is calculated based on the MINT_RATE
     */
    function mint() external payable {
        require(msg.value > 0, "Must send Ether to mint tokens");
        
        uint256 tokenAmount = msg.value * MINT_RATE;
        _mint(msg.sender, tokenAmount);
        
        emit TokensMinted(msg.sender, tokenAmount, msg.value);
    }
    
    /**
     * @notice Allows the contract owner to withdraw accumulated Ether
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No Ether to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }


    //TODO: function to allow users to redeem tokens for Ether, all must be syncronized with the change in the state of the system
}
