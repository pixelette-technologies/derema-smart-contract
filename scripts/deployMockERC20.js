const hre = require("hardhat");
const { parseUnits } = require("ethers");


async function main() {
    const mockERC20 =  await hre.ethers.getContractFactory("contracts/MockERC20.sol:MockERC20");
    console.log("Deployment started");
    const MockERC20 =  await mockERC20.deploy( "Mock Token", "MOCK");
    await MockERC20.waitForDeployment();
    const deployedAddress = await MockERC20.getAddress();
    console.log("MockERC20 deployed to", deployedAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});