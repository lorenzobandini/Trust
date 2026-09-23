import { defineConfig } from 'hardhat/config';
import hardhatToolboxMochaEthers from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import hardhatIgnitionEthers from '@nomicfoundation/hardhat-ignition-ethers';
import hardhatNetworkHelpers from '@nomicfoundation/hardhat-network-helpers';

const config = defineConfig({
  plugins: [
    hardhatToolboxMochaEthers,
    hardhatIgnitionEthers,
    hardhatNetworkHelpers,
  ],
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
});

export default config;
