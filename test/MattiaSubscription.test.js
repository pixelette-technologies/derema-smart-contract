const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("RecipeSubscription", function () {
  let subscription, usdc, usdt, owner, user, user2;

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
    subscription =  await upgrades.deployProxy(recipeSubscription, [usdc.target, usdt.target], {
        initializer: "initialize",
    });
    
    // Mint tokens to users
    await usdc.mint(user.address, ethers.parseUnits("1000", usdcDecimals));
    await usdt.mint(user.address, ethers.parseUnits("1000", usdtDecimals));
    await usdt.mint(user2.address, ethers.parseUnits("1000", usdtDecimals));
  });

  describe("Subscription Flow", () => {
    it("should allow user to subscribe with USDC", async () => {
      await usdc.connect(user).approve(subscription.target, initialUsdcPrice);
  
      const tx = await subscription.connect(user).subscribe(usdc.target);
  
      // ✅ Confirm event was emitted (don't match exact timestamp)
      await expect(tx)
        .to.emit(subscription, "SubscriptionPurchased")
        .withArgs(user.address, anyValue, anyValue); // wildcard match
  
      // ✅ Check subscription state
      const sub = await subscription.subscriptions(user.address);
      expect(sub.isSubscribed).to.be.true;
      expect(sub.isCancelled).to.be.false;
      expect(sub.startTime).to.be.gt(0);
      expect(sub.endTime).to.be.gt(sub.startTime);
    });

    it("should allow user to subscribe with USDT", async () => {
      await usdt.connect(user).approve(subscription.target, initialUsdtPrice);
      await subscription.connect(user).subscribe(usdt.target);

      const sub = await subscription.subscriptions(user.address);
      expect(sub.isSubscribed).to.be.true;
      expect(sub.isCancelled).to.be.false;
      expect(sub.startTime).to.be.gt(0);
      expect(sub.endTime).to.be.gt(sub.startTime);
    });

    it("should revert if user tries to subscribe again while active", async () => {
      await usdc.connect(user).approve(subscription.target, initialUsdcPrice);
      await subscription.connect(user).subscribe(usdc.target);

      await usdc.connect(user).approve(subscription.target, initialUsdcPrice);
      await expect(subscription.connect(user).subscribe(usdc.target)).to.be.revertedWith(
        "Subscription is still active"
      );
    });

    it("should allow user to resubscribe after cancellation", async () => {
      await usdc.connect(user).approve(subscription.target, initialUsdcPrice);
      await subscription.connect(user).subscribe(usdc.target);

      await subscription.cancelSubscription(user.address);

      const subAfterCancel = await subscription.subscriptions(user.address);
      expect(subAfterCancel.isCancelled).to.be.true;
      expect(subAfterCancel.endTime).to.equal(0);

      await usdc.connect(user).approve(subscription.target, initialUsdcPrice);
      await subscription.connect(user).subscribe(usdc.target);

      const subNew = await subscription.subscriptions(user.address);
      expect(subNew.isSubscribed).to.be.true;
      expect(subNew.isCancelled).to.be.false;
      expect(subNew.startTime).to.be.gt(0);
      expect(subNew.endTime).to.be.gt(subNew.startTime);
    });

    it("should revert subscription with invalid token", async () => {
      const fakeToken = other.address;
      await expect(subscription.connect(user).subscribe(fakeToken)).to.be.revertedWith("Invalid payment token");
    });
  });

  describe("Owner functions and access control", () => {
    it("should allow owner to update USDC price", async () => {
      const newPrice = ethers.parseUnits("299", usdcDecimals);
      await expect(subscription.connect(owner).setUsdcPrice(newPrice))
        .to.emit(subscription, "SubscriptionPriceUpdated")
        .withArgs(usdc.target, initialUsdcPrice, newPrice);

      expect(await subscription.usdcPrice()).to.equal(newPrice);
    });

    it("should revert updating USDC price to zero", async () => {
      await expect(subscription.connect(owner).setUsdcPrice(0)).to.be.revertedWith("Invalid price");
    });

    it("should allow owner to update USDT price", async () => {
      const newPrice = ethers.parseUnits("299", usdtDecimals);
      await expect(subscription.connect(owner).setUsdtPrice(newPrice))
        .to.emit(subscription, "SubscriptionPriceUpdated")
        .withArgs(usdt.target, initialUsdtPrice, newPrice);

      expect(await subscription.usdtPrice()).to.equal(newPrice);
    });

    it("should revert updating USDT price to zero", async () => {
      await expect(subscription.connect(owner).setUsdtPrice(0)).to.be.revertedWith("Invalid price");
    });

    it("should revert non-owner trying to update prices", async () => {
      await expect(subscription.connect(user).setUsdcPrice(initialUsdcPrice)).to.be.revertedWithCustomError(subscription, "OwnableUnauthorizedAccount");
      await expect(subscription.connect(user).setUsdtPrice(initialUsdtPrice)).to.be.revertedWithCustomError(subscription, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to set premium", async () => {
      await subscription.connect(owner).setPremium(user.address, true);
      expect(await subscription.isPremium(user.address)).to.be.true;
    });

    it("should revert non-owner trying to set premium", async () => {
      await expect(subscription.connect(user).setPremium(user.address, true)).to.be.revertedWithCustomError(subscription, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to cancel subscription", async () => {
      await usdc.connect(user).approve(subscription.target, initialUsdcPrice);
      await subscription.connect(user).subscribe(usdc.target);
    
      const tx = await subscription.connect(owner).cancelSubscription(user.address);
    
      await expect(tx)
        .to.emit(subscription, "SubscriptionCancelled")
        .withArgs(user.address, anyValue);
    
      const sub = await subscription.subscriptions(user.address);
      expect(sub.isCancelled).to.be.true;
      expect(sub.endTime).to.equal(0);
    });

    it("should revert cancelling subscription if user not subscribed", async () => {
      await expect(subscription.connect(owner).cancelSubscription(user.address)).to.be.revertedWith("Not subscribed");
    });

    it("should revert cancelling subscription if already cancelled", async () => {
      await usdc.connect(user).approve(subscription.target, initialUsdcPrice);
      await subscription.connect(user).subscribe(usdc.target);
      await subscription.connect(owner).cancelSubscription(user.address);

      await expect(subscription.connect(owner).cancelSubscription(user.address)).to.be.revertedWith("Already cancelled");
    });

    it("should revert non-owner cancelling subscription", async () => {
      await expect(subscription.connect(user).cancelSubscription(user.address)).to.be.revertedWithCustomError(subscription, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to pause and unpause", async () => {
      await subscription.connect(owner).pauseSubscriptions();
      expect(await subscription.paused()).to.be.true;

      await subscription.connect(owner).unpauseSubscriptions();
      expect(await subscription.paused()).to.be.false;
    });

    it("should revert non-owner pausing/unpausing", async () => {
      await expect(subscription.connect(user).pauseSubscriptions()).to.be.revertedWithCustomError(subscription, "OwnableUnauthorizedAccount");
      await expect(subscription.connect(user).unpauseSubscriptions()).to.be.revertedWithCustomError(subscription, "OwnableUnauthorizedAccount");
    });

    it("should not allow subscription when paused", async () => {
      await subscription.connect(owner).pauseSubscriptions();
      await usdc.connect(user).approve(subscription.target, initialUsdcPrice);

      await expect(subscription.connect(user).subscribe(usdc.target)).to.be.revertedWithCustomError(subscription, "EnforcedPause");
    });
  });

  describe("Withdrawals", () => {
    it("should allow owner to withdraw USDC tokens", async () => {
      await usdc.connect(user).approve(subscription.target, initialUsdcPrice);
      await subscription.connect(user).subscribe(usdc.target);
    
      const balanceBefore = await usdc.balanceOf(owner.address);
    
      await expect(subscription.connect(owner).withdrawToken(usdc.target))
        .to.emit(subscription, "TokenWithdrawn")
        .withArgs(usdc.target, initialUsdcPrice, owner.address);
    
      const balanceAfter = await usdc.balanceOf(owner.address);
      expect(balanceAfter).to.equal(balanceBefore + initialUsdcPrice);
    });

    it("should allow owner to withdraw USDT tokens", async () => {
      await usdt.connect(user).approve(subscription.target, initialUsdtPrice);
      await subscription.connect(user).subscribe(usdt.target);
    
      const balanceBefore = await usdt.balanceOf(owner.address);
    
      await subscription.connect(owner).withdrawToken(usdt.target);
    
      const balanceAfter = await usdt.balanceOf(owner.address);
    
      expect(balanceAfter).to.equal(balanceBefore + initialUsdtPrice);
    });
    

    it("should revert withdrawal of zero balance", async () => {
      await expect(subscription.connect(owner).withdrawToken(usdc.target)).to.be.revertedWith("No balance to withdraw");
    });

    it("should revert withdrawal with zero address", async () => {
      await expect(subscription.connect(owner).withdrawToken(ethers.ZeroAddress)).to.be.revertedWith("Invalid Token");
    });

    it("should revert non-owner withdrawing tokens", async () => {
      await expect(subscription.connect(user).withdrawToken(usdc.target)).to.be.revertedWithCustomError(subscription, "OwnableUnauthorizedAccount");
    });
  });

  // Helper function to get latest block timestamp
  async function timeLatest() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});
