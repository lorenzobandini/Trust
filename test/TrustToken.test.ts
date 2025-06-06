import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployContractsSetup, mintTokens } from './helpers';

/**
 * @title TrustToken Tests
 * @notice Tests the core functionality of the TrustToken smart contract, including minting, transferring, and approving token transfers.
 */
describe('TrustToken', function () {
  describe('Token Minting', function () {
    /**
     * @notice Ensures users receive the correct amount of tokens when sending Ether.
     */
    it('should mint tokens when sending Ether', async function () {
      const { trustToken, owner } = await loadFixture(deployContractsSetup);
      const mintAmount = ethers.parseEther('1');
      const expectedTokens = mintAmount * BigInt(1000); // MINT_RATE = 1000

      await mintTokens(trustToken, owner, mintAmount);

      const balance = await trustToken.balanceOf(owner.address);
      expect(balance).to.equal(expectedTokens);
    });

    /**
     * @notice Ensures minting fails when no Ether is sent.
     */
    it('should fail to mint tokens with zero Ether', async function () {
      const { trustToken, owner } = await loadFixture(deployContractsSetup);

      await expect(
        trustToken.connect(owner).mint({ value: 0 })
      ).to.be.revertedWith('Invalid amount');
    });
  });

  describe('Token Transfers', function () {
    /**
     * @notice Verifies that a user can transfer tokens to another account.
     */
    it('should transfer tokens between accounts', async function () {
      const { trustToken, owner, alice } =
        await loadFixture(deployContractsSetup);
      const mintAmount = ethers.parseEther('1');
      const transferAmount = ethers.parseEther('500'); // Half of minted tokens

      await mintTokens(trustToken, owner, mintAmount);
      await trustToken.transfer(alice.address, transferAmount);

      const aliceBalance = await trustToken.balanceOf(alice.address);
      expect(aliceBalance).to.equal(transferAmount);
    });

    /**
     * @notice Ensures that users cannot transfer more tokens than they own.
     */
    it('should fail to transfer more tokens than balance', async function () {
      const { trustToken, owner, alice } =
        await loadFixture(deployContractsSetup);
      const mintAmount = ethers.parseEther('1');
      const transferAmount = ethers.parseEther('2000'); // More than minted (1000 tokens)

      await mintTokens(trustToken, owner, mintAmount);
      await expect(
        trustToken.transfer(alice.address, transferAmount)
      ).to.be.revertedWithCustomError(trustToken, 'ERC20InsufficientBalance');
    });
  });

  describe('Token Approvals', function () {
    /**
     * @notice Confirms that token approval sets the correct allowance.
     */
    it('should approve and transfer tokens', async function () {
      const { trustToken, owner, alice } =
        await loadFixture(deployContractsSetup);
      const mintAmount = ethers.parseEther('1');
      const approveAmount = ethers.parseEther('500');

      await mintTokens(trustToken, owner, mintAmount);
      await trustToken.approve(alice.address, approveAmount);

      const allowance = await trustToken.allowance(
        owner.address,
        alice.address
      );
      expect(allowance).to.equal(approveAmount);
    });
    /**
     * @notice Ensures delegated transfers fail when exceeding approved amount.
     */
    it('should fail to transfer more tokens than approved', async function () {
      const { trustToken, owner, alice, bob, charlie } =
        await loadFixture(deployContractsSetup);
      const mintAmount = ethers.parseEther('1');
      const approveAmount = ethers.parseEther('500');
      const transferAmount = ethers.parseEther('600'); // More than approved

      await mintTokens(trustToken, owner, mintAmount);
      await trustToken.approve(alice.address, approveAmount);

      await expect(
        trustToken
          .connect(bob)
          .transferFrom(alice.address, charlie.address, transferAmount)
      ).to.be.revertedWithCustomError(trustToken, 'ERC20InsufficientAllowance');
    });
  });
  describe('Ether Withdrawal', function () {
    /**
     * @notice Verifies that the owner can withdraw accumulated Ether from token minting
     */
    it('should allow owner to withdraw accumulated Ether', async function () {
      const { trustToken, owner, alice } =
        await loadFixture(deployContractsSetup);
      const mintAmount = ethers.parseEther('1');

      // Alice mints tokens, sending Ether to the contract
      await mintTokens(trustToken, alice, mintAmount);

      // Check contract has received Ether
      const contractBalance = await ethers.provider.getBalance(
        await trustToken.getAddress()
      );
      expect(contractBalance).to.equal(mintAmount);

      // Owner withdraws Ether
      await expect(trustToken.connect(owner).withdraw()).to.not.be.reverted;

      // Check contract balance is now zero
      const contractBalanceAfter = await ethers.provider.getBalance(
        await trustToken.getAddress()
      );
      expect(contractBalanceAfter).to.equal(0);
    });

    /**
     * @notice Ensures non-owners cannot withdraw Ether
     */
    it('should fail when non-owner tries to withdraw', async function () {
      const { trustToken, owner, alice } =
        await loadFixture(deployContractsSetup);
      const mintAmount = ethers.parseEther('1');

      // Owner mints tokens to add Ether to contract
      await mintTokens(trustToken, owner, mintAmount);

      // Alice (non-owner) tries to withdraw
      await expect(
        trustToken.connect(alice).withdraw()
      ).to.be.revertedWithCustomError(trustToken, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Token Redemption', function () {
    /**
     * @notice Verifies that users can redeem tokens for Ether with 2% fee
     */
    it('should allow users to redeem tokens for Ether with fee', async function () {
      const { trustToken, alice } = await loadFixture(deployContractsSetup);
      const mintAmount = ethers.parseEther('1');
      const tokenAmount = ethers.parseEther('1000'); // 1000 tokens

      // Alice mints tokens
      await mintTokens(trustToken, alice, mintAmount);

      // Get Alice's initial Ether balance
      const aliceBalanceBefore = await ethers.provider.getBalance(
        alice.address
      );

      // Alice redeems tokens
      const tx = await trustToken.connect(alice).redeem(tokenAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      // Check Alice's token balance is now zero
      const aliceTokenBalance = await trustToken.balanceOf(alice.address);
      expect(aliceTokenBalance).to.equal(0);

      // Calculate expected Ether received (1 ETH - 2% fee = 0.98 ETH)
      const expectedEthAmount = ethers.parseEther('1');
      const expectedFee = (expectedEthAmount * BigInt(2)) / BigInt(100);
      const expectedEthToUser = expectedEthAmount - expectedFee;

      // Check Alice received correct Ether amount (minus gas costs)
      const aliceBalanceAfter = await ethers.provider.getBalance(alice.address);
      const expectedAliceBalance =
        aliceBalanceBefore + expectedEthToUser - gasUsed;
      expect(aliceBalanceAfter).to.equal(expectedAliceBalance);

      // Check contract still has the fee
      const contractBalance = await ethers.provider.getBalance(
        await trustToken.getAddress()
      );
      expect(contractBalance).to.equal(expectedFee);
    });

    /**
     * @notice Ensures redemption fails when user has insufficient tokens
     */
    it('should fail to redeem more tokens than balance', async function () {
      const { trustToken, alice } = await loadFixture(deployContractsSetup);
      const tokenAmount = ethers.parseEther('1000'); // Alice has no tokens

      await expect(
        trustToken.connect(alice).redeem(tokenAmount)
      ).to.be.revertedWith('Insufficient token balance');
    });
  });
});
