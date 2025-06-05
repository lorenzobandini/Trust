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
      ).to.be.revertedWith('Amount must be greater than 0');
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
});
