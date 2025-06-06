# TRUST: Ethereum-based Splitwise

TRUST is a blockchain-based implementation of Splitwise, a cost splitting and accountability application built on the Ethereum blockchain. This project implements a decentralized expense sharing system using smart contracts to manage groups, expenses, debts, and payments.

## Overview

TRUST provides a transparent and tamper-proof solution for group expense management with the following advantages:

- **Transparency**: All participants can verify expense registrations
- **Immutability**: Recorded expenses cannot be altered or deleted
- **Native Payments**: Users can settle balances with ERC-20 tokens seamlessly across borders

## Features

### Core Functionalities

- **Group Creation**: Users can create groups and specify member addresses
- **Group Management**: Join existing groups, leave groups, and delete groups
- **Expense Registration**: Record expenses with various split methods (equal, exact amounts, percentages)
- **Debt Simplification**: Minimize transaction count using a greedy algorithm
- **Debt Settlement**: Pay debts using ERC-20 tokens with automatic balance updates

### Smart Contracts

#### GroupManager.sol

Handles group creation and membership management:

- Create groups with initial members
- Join/leave groups
- Maximum 50 members per group
- Access control for group operations

#### ExpenseManager.sol

Manages expense registration and debt tracking:

- Record expenses with flexible split methods
- Automatic debt graph updates
- Net balance calculations
- Integration with group membership verification

#### DebtSimplifier.sol

Implements the greedy debt simplification algorithm:

- Linear time complexity O(n)
- Minimizes number of required transactions
- Preserves individual net balances
- Generates optimized payment plan

#### TrustToken.sol

ERC-20 token contract for payments:

- Mint tokens with Ether (1 ETH = 1000 TRUST)
- Token redemption with 2% fee
- Automatic debt settlement integration
- Owner withdrawal functionality

## Installation and Setup

### Prerequisites

- Node.js (v18 or higher)
- pnpm package manager
- Hardhat development environment

### Installation

```bash
git clone https://github.com/lorenzobandini/Trust.git
cd Trust
pnpm install
```

### Compilation

```bash
pnpm run compile
```

### Testing

```bash
# Run all tests
pnpm run test

# Run tests with gas reporting
pnpm run test:gas

# Generate coverage report
pnpm run test:coverage
```

### Deployment

```bash
# Deploy to local Hardhat network
pnpm run deploy
```

## Project Structure

```text
contracts/
├── GroupManager.sol      # Group management
├── ExpenseManager.sol    # Expense and debt tracking
├── DebtSimplifier.sol    # Debt optimization
└── TrustToken.sol        # ERC-20 payment token

test/
├── GroupManager.test.ts
├── ExpenseManager.test.ts
├── DebtSimplifier.test.ts
├── TrustToken.test.ts
└── TrustIntegration.test.ts

ignition/
└── modules/
    └── TrustDeployment.ts   # Deployment configuration
```

## License

This project is licensed under the GPL-3.0 License.
