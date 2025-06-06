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
    uint16 public constant MINT_RATE = 1000;
    
    // Redemption fee percentage (2%)
    uint16 public constant REDEMPTION_FEE_PERCENT = 2;
    
    // Modifiers
    modifier validAmount(uint256 amount) {
        require(amount > 0, "Invalid amount");
        _;
    }
    
    // Event emitted when tokens are minted
    event TokensMinted(address indexed to, uint128 amount, uint128 ethAmount);
    
    // Event emitted when tokens are redeemed
    event TokensRedeemed(address indexed from, uint128 tokenAmount, uint128 ethAmount, uint128 feeAmount);
    
    constructor() ERC20("TRUST Token", "TRUST") Ownable(msg.sender) {}
    
    /**
     * @notice Mints new tokens in exchange for Ether
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

    /**
     * @notice Allows users to redeem tokens for Ether with a 2% fee
     * @param tokenAmount The amount of tokens to redeem
     * @dev Burns the tokens and sends Ether minus fee to the user
     */
    function redeem(uint256 tokenAmount) external validAmount(tokenAmount) {
        require(tokenAmount <= balanceOf(msg.sender), "Insufficient token balance");
        require(tokenAmount <= type(uint128).max, "Redeem limit exceeded");
        
        uint128 tokenAmountSafe = uint128(tokenAmount);
        
        // Calculate Ether amount before fee
        uint256 ethAmountFull = tokenAmount / MINT_RATE;
        require(ethAmountFull > 0, "Token amount too small");
        require(ethAmountFull <= type(uint128).max, "Ether amount too large");
        
        uint128 ethAmountBeforeFee = uint128(ethAmountFull);
        
        // Calculate fee (2% of Ether amount)
        uint128 feeAmount = (ethAmountBeforeFee * REDEMPTION_FEE_PERCENT) / 100;
        uint128 ethToUser = ethAmountBeforeFee - feeAmount;
        
        // Check contract has enough Ether (full amount including what stays as fee)
        require(address(this).balance >= ethAmountBeforeFee, "Insufficient contract balance");
        
        // Burn tokens from user
        _burn(msg.sender, tokenAmountSafe);
        
        // Send Ether to user (minus fee)
        (bool success, ) = msg.sender.call{value: ethToUser}("");
        require(success, "Ether transfer failed");
        
        emit TokensRedeemed(msg.sender, tokenAmountSafe, ethToUser, feeAmount);
    }
}
