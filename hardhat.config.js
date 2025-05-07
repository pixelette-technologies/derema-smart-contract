require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades")
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  etherscan: {
    apiKey: {
      bscTestnet: process.env.TESTNET_BSCSCAN_API_KEY,
      bsc: process.env.MAINNET_BSCSCAN_API_KEY, 
    }
  },

  defaultNetwork: "hardhat",
  
  networks: {
    hardhat: { 
      chainId: 31337
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL,
      chainId: 97,
      accounts: [process.env.PRIVATE_KEY]
    },
    bsc: {
      url: process.env.BSC_MAINNET_RPC_URL, 
      chainId: 56, 
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};