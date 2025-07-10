const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("RecipeNFT Contract", function () {
  let owner, user, user2, other;
  let recipeNFT, subscriptionContract;
  let usdc, usdt;

  const usdcDecimals = 6;
  const usdtDecimals = 18;
  const initialUsdcPrice = ethers.parseUnits("199", usdcDecimals);
  const initialUsdtPrice = ethers.parseUnits("199", usdtDecimals);

  beforeEach(async () => {
    [owner, user, user2, other] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const usdcToken = await ethers.getContractFactory("MockUSDC");
    const usdtToken = await ethers.getContractFactory("MockUSDT");

    usdc = await usdcToken.deploy("USDC Token", "USDC");    
    usdt = await usdtToken.deploy("USDT Token", "USDT");

    // Deploy subscription contract
    const recipeSubscription =  await ethers.getContractFactory("RecipeSubscription");
    console.log("🚀 ~ RecipeSubscription deployment started");
    subscriptionContract =  await upgrades.deployProxy(recipeSubscription, [usdc.target, usdt.target], {
        initializer: "initialize",
    });
      
    // Mint tokens to users
    await usdc.mint(user.address, ethers.parseUnits("1000", usdcDecimals));
    await usdt.mint(user.address, ethers.parseUnits("1000", usdtDecimals));
    await usdt.mint(user2.address, ethers.parseUnits("1000", usdtDecimals));

    // Deploy RecipeNFT as upgradeable proxy with subscriptionContract address
    const RecipeNFT = await ethers.getContractFactory("RecipeNFT");
    recipeNFT = await upgrades.deployProxy(
      RecipeNFT,
      [subscriptionContract.target, "ipfs://placeholder/"],
      { initializer: "initialize" }
    );
  });

  describe("Subscription-dependent functions", function () {
    it("isPaidUser returns true for subscribed user", async () => {
      // Setup: subscribe user in subscription contract with valid expiry in future and not cancelled
      await usdc.connect(user).approve(subscriptionContract.target, initialUsdcPrice);
  
      await subscriptionContract.connect(user).subscribe(usdc.target);
      await subscriptionContract.connect(owner).setPremium(user.address, false);
      expect(await recipeNFT.isPaidUser(user.address)).to.be.true;
    });

    it("mintRecipeForPaidUsers succeeds for valid subscriber", async () => {
      // Setup subscription state for user
      await subscriptionContract.connect(owner).setPremium(user.address, true);
      const amount = 3;
      const royaltyBps = 500;

      await expect(recipeNFT.connect(user).mintRecipeForPaidUsers(amount, royaltyBps))
        .to.emit(recipeNFT, "PaidMinted")
        .withArgs(user.address, anyValue, amount);

      expect(await recipeNFT.balanceOf(user.address)).to.equal(amount);
    });

    it("mintRecipeForPaidUsers reverts for non-subscribed user", async () => {
      await expect(
        recipeNFT.connect(user).mintRecipeForPaidUsers(1, 500)
      ).to.be.revertedWith("Subscription invalid or expired");
    });

    it("buyLazyMintedRecipe allows anyone to lazy mint", async () => {
      const amount = 2;
      await expect(recipeNFT.connect(user2).buyLazyMintedRecipe(user.address, amount))
        .to.emit(recipeNFT, "LazyMinted")
        .withArgs(user2.address, user.address, anyValue, amount);

      expect(await recipeNFT.balanceOf(user2.address)).to.equal(amount);
    });

    it("pause and unpause can only be called by owner", async () => {
      await recipeNFT.connect(owner).pause();
      expect(await recipeNFT.paused()).to.be.true;

      await recipeNFT.connect(owner).unpause();
      expect(await recipeNFT.paused()).to.be.false;

      await expect(recipeNFT.connect(user).pause()).to.be.revertedWithCustomError(subscriptionContract, "OwnableUnauthorizedAccount");
    });

    it("tokenURI returns placeholderURI for minted token", async () => {
      await subscriptionContract.connect(owner).setPremium(user.address, true);
      await recipeNFT.connect(user).mintRecipeForPaidUsers(1, 100);

      expect(await recipeNFT.tokenURI(0)).to.equal("ipfs://placeholder/");
      await expect(recipeNFT.tokenURI(999)).to.be.revertedWith("Token does not exist");
    });
  });
});