const hre = require("hardhat");
const { upgrades } = require("hardhat"); // Add this line


const deployMockToken = async (name, symbol) => {
    const mockERC20 =  await hre.ethers.getContractFactory("contracts/MockERC20.sol:MockERC20");
    console.log(`🚀 ~ Mock token deployment started ~ (${name}) (${symbol})`);
    const MockERC20 =  await mockERC20.deploy(name, symbol);
    await MockERC20.waitForDeployment();
    const deployedAddress = await MockERC20.getAddress();
    console.log("🚀 ~ deployMockToken ~ deployedAddress:", deployedAddress)
    return deployedAddress;
}

const deployRecipeSubscription = async (usdc, usdt) => {
    console.log("🚀 ~ deployRecipeSubscription ~ usdt:", usdt);
    console.log("🚀 ~ deployRecipeSubscription ~ usdc:", usdc);
    
    const recipeSubscription =  await hre.ethers.getContractFactory("contracts/RecipeSubscription.sol:RecipeSubscription");
    console.log("🚀 ~ RecipeSubscription deployment started");
    const RecipeSubscription =  await upgrades.deployProxy(recipeSubscription, [usdc, usdt], {
        initializer: "initialize",
    });
    await RecipeSubscription.waitForDeployment();
    const deployedAddress = await RecipeSubscription.getAddress();
    console.log("🚀 ~ RecipeSubscription ~ deployedAddress:", deployedAddress)
    return deployedAddress;
}

const deployRecipeNft = async (subscription, uri) => {
    const recipeNft =  await hre.ethers.getContractFactory("contracts/RecipeNFT.sol:RecipeNFT");
    console.log("🚀 ~ RecipeNft deployment started");
    const RecipeNft =  await upgrades.deployProxy(recipeNft, [subscription, uri], {
        initializer: "initialize",
    });
    await RecipeNft.waitForDeployment();
    const deployedAddress = await RecipeNft.getAddress();
    console.log("🚀 ~ deployRecipeNft ~ deployedAddress:", deployedAddress)
    return deployedAddress;
}

const deployRecipeMarketplace = async (nft, usdc, usdt) => {
    const recipeMarketplace =  await hre.ethers.getContractFactory("contracts/RecipeMarketplace.sol:RecipeMarketplace");
    console.log("🚀 ~ RecipeMarketplace deployment started");
    const RecipeMarketPlace =  await upgrades.deployProxy(recipeMarketplace, [nft, usdc, usdt], {
        initializer: "initialize",
    });
    await RecipeMarketPlace.waitForDeployment();
    const deployedAddress = await RecipeMarketPlace.getAddress();
    console.log("🚀 ~ deployRecipeMarketplace ~ deployedAddress:", deployedAddress)
}


async function main() {
    //Mock Tokens Deployment
    // const usdcToken = await deployMockToken("usdcMock", "USDCM");
    // const usdtToken = await deployMockToken("usdtMock", "USDTM");

    // const usdcToken = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
    // const usdtToken = "0x55d398326f99059fF775485246999027B3197955"


    const usdcToken = "0x1736e3C13e2Ad2510caA0900b9485add19d6871D"
    const usdtToken = "0x978Cd5D8B283f6DBE2BDCde8d95545729197e441"    

    //Subscription Contract Deployment
    // const recipeSubscriprionContract = await deployRecipeSubscription(usdcToken, usdtToken);

    //NFT contract Deployment
    // const recipeNftContract = await deployRecipeNft(recipeSubscriprionContract, "Ipfs://recipe");
    const recipeNftContract = "0x3495EE22721a1394a62c96522733428292981E6C";


    //marketplace contract deployment
    await deployRecipeMarketplace(recipeNftContract, usdcToken, usdtToken);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
