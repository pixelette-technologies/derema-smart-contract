const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RecipeMarketplace Contract", function () {
  let owner, user1, user2;
  let usdc, usdt, recipeNFT, marketplace;
  const royaltyFee = 500; // 5%
  const mintAmount = 1;
  const price = ethers.parseUnits("100", 6);

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("MockERC20");
    usdc = await ERC20Mock.deploy("USDC", "USDC");
    usdt = await ERC20Mock.deploy("USDT", "USDT");

    const Subscription = await ethers.getContractFactory("RecipeSubscription");
    subscriptionContract = await Subscription.deploy(usdc.target, usdt.target);

    // Deploy RecipeNFT Contract
    const RecipeNFT = await ethers.getContractFactory("RecipeNFT");
    recipeNFT = await RecipeNFT.deploy(subscriptionContract.target, "https://example.com");

    const Marketplace = await ethers.getContractFactory("RecipeMarketplace");
    marketplace = await Marketplace.deploy(recipeNFT.target, usdc.target, usdt.target);

    await subscriptionContract.setPremium(user1.address, true);
    await subscriptionContract.setPremium(user2.address, true);

    await usdc.mint(user2.address, ethers.parseUnits("10000", 6));
    await usdc.connect(user2).approve(marketplace.target, ethers.parseUnits("10000", 6));

    await recipeNFT.connect(user1).mintRecipeForPaidUsers(mintAmount, royaltyFee);
    await recipeNFT.connect(user1).setApprovalForAll(marketplace.target, true);
  });

  describe("Listing", function () {
    it("should list a recipe successfully", async function () {
      await marketplace.connect(user1).listRecipe(0, price, usdc.target);

      const listing = await marketplace.listings(0);
      expect(listing.price).to.equal(price);
      expect(listing.seller).to.equal(user1.address);
    });

    it("should revert if not owner tries to list", async function () {
      await expect(
        marketplace.connect(user2).listRecipe(0, price, usdc.target)
      ).to.be.revertedWith("Not owner");
    });

    it("should revert if already listed", async function () {
      await marketplace.connect(user1).listRecipe(0, price, usdc.target);

      await expect(
        marketplace.connect(user1).listRecipe(0, price, usdc.target)
      ).to.be.revertedWith("Already listed");
    });
  });

  describe("Buying", function () {
    beforeEach(async () => {
      await marketplace.connect(user1).listRecipe(0, price, usdc.target);
    });

    it("should buy a listed recipe", async function () {
      const [royaltyReceiver, royaltyAmount] = await recipeNFT.royaltyInfo(0, price);
      console.log("🚀 ~ royaltyAmount:", royaltyAmount)

      const sellerBalanceBefore = await usdc.balanceOf(user1.address);
      console.log("🚀 ~ sellerBalanceBefore:", sellerBalanceBefore)
      const royaltyBalanceBefore = await usdc.balanceOf(royaltyReceiver);
      console.log("🚀 ~ royaltyBalanceBefore:", royaltyBalanceBefore)

      await marketplace.connect(user2).buyRecipe(0);
			
      expect(await recipeNFT.ownerOf(0)).to.equal(user2.address);

      const listing = await marketplace.listings(0);

			expect(listing.price).to.equal(0);
			expect(listing.seller).to.equal(ethers.ZeroAddress);
			expect(listing.paymentToken).to.equal(ethers.ZeroAddress);
      
      const sellerBalanceAfter = await usdc.balanceOf(user1.address);
      console.log("🚀 ~ sellerBalanceAfter:", sellerBalanceAfter)
      const royaltyBalanceAfter = await usdc.balanceOf(royaltyReceiver);

      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(price);
      expect(royaltyBalanceAfter - royaltyBalanceBefore).to.equal(price);
    });

    it("should revert if recipe is not listed", async function () {
      await marketplace.connect(user1).cancelListing(0);
      await expect(marketplace.connect(user2).buyRecipe(0)).to.be.revertedWith("Not listed");
    });
  });

  describe("Cancel Listing", function () {
    it("should allow owner to cancel listing", async function () {
      await marketplace.connect(user1).listRecipe(0, price, usdc.target);

      await expect(marketplace.connect(user1).cancelListing(0))
        .to.emit(marketplace, "RecipeCancelled");

      const listing = await marketplace.listings(0);
      expect(listing.price).to.equal(0);
    });

    it("should revert if non-owner tries to cancel", async function () {
      await marketplace.connect(user1).listRecipe(0, price, usdc.target);
      await expect(marketplace.connect(user2).cancelListing(0)).to.be.revertedWith("Not the owner");
    });
  });

  describe("Update Listing", function () {
    const newPrice = ethers.parseUnits("200", 6);

    it("should allow owner to update listing", async function () {
      await marketplace.connect(user1).listRecipe(0, price, usdc.target);

      await expect(marketplace.connect(user1).updateListing(0, newPrice, usdt.target))
        .to.emit(marketplace, "RecipeListed");

      const updatedListing = await marketplace.listings(0);
      expect(updatedListing.price).to.equal(newPrice);
      expect(updatedListing.paymentToken).to.equal(usdt.target);
    });

    it("should revert for unsupported payment token", async function () {
      const invalidToken = ethers.Wallet.createRandom().address;
      await marketplace.connect(user1).listRecipe(0, price, usdc.target);
      await expect(
        marketplace.connect(user1).updateListing(0, newPrice, invalidToken)
      ).to.be.revertedWith("Unsupported token");
    });

    it("should revert if called by non-owner", async function () {
      await marketplace.connect(user1).listRecipe(0, price, usdc.target);
      await expect(
        marketplace.connect(user2).updateListing(0, newPrice, usdc.target)
      ).to.be.revertedWith("Not the owner");
    });
  });
});
