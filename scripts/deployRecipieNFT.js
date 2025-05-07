const hre = require("hardhat");

async function main() {
    const recipeNft =  await hre.ethers.getContractFactory("contracts/RecipeNFT.sol:RecipeNFT");
    console.log("Deployment started");
    const RecipeNft =  await recipeNft.deploy( "0x997FeF7DA27A51854873b89af5b83d81A77a9557", "//ipfs:Recipes");
    await RecipeNft.waitForDeployment();
    const deployedAddress = await RecipeNft.getAddress();
    console.log("RecipieNft deployed to", deployedAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});