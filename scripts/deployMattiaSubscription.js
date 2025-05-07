const hre = require("hardhat");

async function main() {
    const mattiaSubscription =  await hre.ethers.getContractFactory("contracts/MattiaSubscription.sol:MattiaSubscription");
    console.log("Deployment started");
    const MattiaSubscription =  await mattiaSubscription.deploy( "0x0E4ABF12214894efb03BFd1E680B01e3bd764c58", "0x0E4ABF12214894efb03BFd1E680B01e3bd764c58");
    await MattiaSubscription.waitForDeployment();
    const deployedAddress = await MattiaSubscription.getAddress();
    console.log("MattiaSubscription deployed to", deployedAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

// adding both token sto the subscription contract