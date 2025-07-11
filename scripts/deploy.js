const hre = require("hardhat");
const { upgrades } = require("hardhat"); // Add this line


const deployMockToken = async (name, symbol) => {
    const mockERC20 =  await hre.ethers.getContractFactory("contracts/MockUSDC.sol:MockUSDC");
    console.log(`🚀 ~ Mock token deployment started ~ (${name}) (${symbol})`);
    const MockERC20 =  await mockERC20.deploy(name, symbol);
    await MockERC20.waitForDeployment();
    const deployedAddress = await MockERC20.getAddress();
    console.log("🚀 ~ deployMockToken ~ deployedAddress:", deployedAddress)
    return deployedAddress;
}

const deployMockToken2 = async (name, symbol) => {
    const mockERC20 =  await hre.ethers.getContractFactory("contracts/MockUSDT.sol:MockUSDT");
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
    // Mock Tokens Deployment
    const usdcToken = await deployMockToken("usdcMock", "USDCM");
    const usdtToken = await deployMockToken2("usdtMock", "USDTM");
 
    const recipeSubscriprionContract = await deployRecipeSubscription(usdcToken, usdtToken);

    //NFT contract Deployment
    const recipeNftContract = await deployRecipeNft(recipeSubscriprionContract, "Ipfs://recipe");

    //marketplace contract deployment
    await deployRecipeMarketplace(recipeNftContract, usdcToken, usdtToken);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
