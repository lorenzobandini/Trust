import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-ethers';
import '@typechain/hardhat';

const config: HardhatUserConfig = {
  solidity: '0.8.28',
  typechain: {
    target: 'ethers-v6',
  },
};

export default config;
