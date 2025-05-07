const hre = require("hardhat");

async function main() {
    const recipeMarketplace =  await hre.ethers.getContractFactory("contracts/RecipeNFT.sol:RecipeMarketplace");
    console.log("Deployment started");
    const RecipeMarketPlace =  await recipeMarketplace.deploy( "0x997FeF7DA27A51854873b89af5b83d81A77a9557", "0x997FeF7DA27A51854873b89af5b83d81A77a9557", "0x997FeF7DA27A51854873b89af5b83d81A77a9557");
    await RecipeMarketPlace.waitForDeployment();
    const deployedAddress = await RecipeMarketPlace.getAddress();
    console.log("RecipeMarketPlace deployed to", deployedAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});