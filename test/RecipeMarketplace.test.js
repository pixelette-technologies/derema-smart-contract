const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("RecipeMarketplace Contract", function () {
  let owner, user, user2, other;
  let recipeNFT, subscriptionContract, marketplace;
  let usdc, usdt;

  const usdcDecimals = 6;
  const usdtDecimals = 18;
  const initialUsdcPrice = ethers.parseUnits("199", usdcDecimals);
  const initialUsdtPrice = ethers.parseUnits("199", usdtDecimals);

  beforeEach(async () => {
    [owner, user, user2, other] = await ethers.getSigners();

    const usdcToken = await ethers.getContractFactory("MockUSDC");
    const usdtToken = await ethers.getContractFactory("MockUSDT");
    usdc = await usdcToken.deploy("USDC Token", "USDC");
    usdt = await usdtToken.deploy("USDT Token", "USDT");

    const recipeSubscription = await ethers.getContractFactory("RecipeSubscription");
    subscriptionContract = await upgrades.deployProxy(recipeSubscription, [usdc.target, usdt.target], { initializer: "initialize" });

    const RecipeNFT = await ethers.getContractFactory("RecipeNFT");
    recipeNFT = await upgrades.deployProxy(RecipeNFT, [subscriptionContract.target, "ipfs://placeholder/"], { initializer: "initialize" });

    const Marketplace = await ethers.getContractFactory("RecipeMarketplace");
    marketplace = await upgrades.deployProxy(Marketplace, [recipeNFT.target, usdc.target, usdt.target], { initializer: "initialize" });

    await usdc.mint(user.address, ethers.parseUnits("1000", usdcDecimals));
    await usdt.mint(user.address, ethers.parseUnits("1000", usdtDecimals));
    await usdt.mint(user2.address, ethers.parseUnits("1000", usdtDecimals));

    // subscribe user
    await subscriptionContract.connect(owner).setPremium(user.address, true);
    // approve marketplace
    await recipeNFT.connect(user).mintRecipeForPaidUsers(1, 100);
    await recipeNFT.connect(user).setApprovalForAll(marketplace.target, true);
  });

  describe("Listing", () => {
    it("should allow paid user to list a recipe", async () => {
      await expect(marketplace.connect(user).listRecipe(0, ethers.parseUnits("100", usdcDecimals), usdc.target))
        .to.emit(marketplace, "RecipeListed")
        .withArgs(0, user.address, ethers.parseUnits("100", usdcDecimals), usdc.target);
    });

    it("should revert if already listed", async () => {
      await marketplace.connect(user).listRecipe(0, ethers.parseUnits("100", usdcDecimals), usdc.target);
      await expect(marketplace.connect(user).listRecipe(0, ethers.parseUnits("100", usdcDecimals), usdc.target))
        .to.be.revertedWith("Already listed");
    });
  });

  describe("Buying", () => {
    beforeEach(async () => {
      await marketplace.connect(user).listRecipe(0, ethers.parseUnits("100", usdcDecimals), usdc.target);
      await usdc.connect(user2).approve(marketplace.target, ethers.parseUnits("1000", usdcDecimals));
      await usdc.mint(user2.address, ethers.parseUnits("100", usdcDecimals));
      await subscriptionContract.connect(owner).setPremium(user2.address, true);
    });

    it("should allow paid user to buy a listed recipe", async () => {
      await expect(marketplace.connect(user2).buyRecipe(0))
        .to.emit(marketplace, "RecipeSold")
        .withArgs(0, user2.address, user.address, ethers.parseUnits("100", usdcDecimals), usdc.target, anyValue);
    });
  });

  describe("Cancel Listing", () => {
    it("should allow owner to cancel listing", async () => {
      await marketplace.connect(user).listRecipe(0, ethers.parseUnits("100", usdcDecimals), usdc.target);
      await expect(marketplace.connect(user).cancelListing(0))
        .to.emit(marketplace, "RecipeCancelled")
        .withArgs(user.address, 0);
    });

    it("should revert if not owner tries to cancel", async () => {
      await marketplace.connect(user).listRecipe(0, ethers.parseUnits("100", usdcDecimals), usdc.target);
      await expect(marketplace.connect(user2).cancelListing(0)).to.be.revertedWith("Not the owner");
    });
  });

  describe("Batch Listing", () => {
    it("should batch list tokens up to MAX_LISTINGS", async () => {
      await recipeNFT.connect(user).mintRecipeForPaidUsers(10, 100);
      const tokenIds = Array.from({ length: 10 }, (_, i) => i);
      await expect(marketplace.connect(user).batchListRecipes(tokenIds, ethers.parseUnits("10", usdcDecimals), usdc.target))
        .to.emit(marketplace, "RecipeListed")
        .withArgs(0, user.address, ethers.parseUnits("10", usdcDecimals), usdc.target);
    });

    it("should skip already listed or unauthorized tokens", async () => {
      await recipeNFT.connect(user).mintRecipeForPaidUsers(2, 100);
      await marketplace.connect(user).listRecipe(0, ethers.parseUnits("5", usdcDecimals), usdc.target);
      await marketplace.connect(user).batchListRecipes([0, 1], ethers.parseUnits("10", usdcDecimals), usdc.target);
      const listing = await marketplace.listings(1);
      expect(listing.seller).to.equal(user.address);
    });
  });

  describe("Pause Control", () => {
    it("should only allow owner to pause/unpause", async () => {
      await marketplace.connect(owner).pause();
      expect(await marketplace.paused()).to.be.true;

      await marketplace.connect(owner).unpause();
      expect(await marketplace.paused()).to.be.false;

      await expect(marketplace.connect(user).pause()).to.be.revertedWithCustomError(subscriptionContract, "OwnableUnauthorizedAccount");
    });
  });
});
