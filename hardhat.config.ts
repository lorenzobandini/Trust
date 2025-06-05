import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    target: 'ethers-v6',
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 20,
    outputFile: 'gas-report.txt',
    noColors: true,
    rst: true,
  },
};

export default config;
