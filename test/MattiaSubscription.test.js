const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MattiaSubscription", function () {
  let subscription, usdc, usdt, owner, user, user2;

  const subscriptionPrice = ethers.parseUnits("199", 6); // 199 USDC/USDT
  
  beforeEach(async () => {
    [owner, user, user2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    usdc = await Token.deploy("USDC Token", "USDC");
    usdt = await Token.deploy("USDT Token", "USDT");

    const Subscription = await ethers.getContractFactory("MattiaSubscription");
    subscription = await Subscription.deploy(usdc.target, usdt.target);

    await usdc.mint(user.address, ethers.parseUnits("1000", 6));
    await usdt.mint(user.address, ethers.parseUnits("1000", 6));
    await usdt.mint(user2.address, ethers.parseUnits("1000", 6));

  });

  it("should allow user to subscribe with USDC", async () => {
    await usdc.connect(user).approve(subscription.target, subscriptionPrice);
    await subscription.connect(user).subscribe(usdc.target);

    const sub = await subscription.subscriptions(user.address);

    expect(sub.isSubscribed).to.be.true;
    expect(sub.isCancelled).to.be.false;
    expect(sub.startTime).to.be.gt(0);
    expect(sub.endTime).to.be.gt(sub.startTime);
  });

  it("should allow owner to cancel a subscription", async () => {
    await usdc.connect(user).approve(subscription.target, subscriptionPrice);
    await subscription.connect(user).subscribe(usdc.target);

    await subscription.cancelSubscription(user.address);
    const sub = await subscription.subscriptions(user.address);
    expect(sub.isCancelled).to.be.true;
    expect(sub.endTime).to.equal(0);
  });

  it("should allow subscription only after previous one expired or cancelled", async () => {
    await usdc.connect(user).approve(subscription.target, subscriptionPrice);
    await subscription.connect(user).subscribe(usdc.target);
  
    await usdc.connect(user).approve(subscription.target, subscriptionPrice);
    await expect(subscription.connect(user).subscribe(usdc.target))
      .to.be.revertedWith("Subscription is still active");
  
    await subscription.cancelSubscription(user.address);
    const sub2 = await subscription.subscriptions(user.address);
    expect(sub2.isCancelled).to.be.true;
    expect(sub2.endTime).to.equal(0);
  
    await usdc.connect(user).approve(subscription.target, subscriptionPrice);
    await subscription.connect(user).subscribe(usdc.target);
  
    const sub3 = await subscription.subscriptions(user.address);
    expect(sub3.isSubscribed).to.be.true;
    expect(sub3.isCancelled).to.be.false;
    expect(sub3.startTime).to.be.gt(sub2.endTime);
    expect(sub3.endTime).to.be.gt(sub3.startTime);
  });
  
  it("should reject subscription with invalid token", async () => {
    const fakeToken = user.address;
    await expect(subscription.connect(user).subscribe(fakeToken)).to.be.revertedWith("Invalid payment token");
  });

  it("should update the subscription price", async () => {
    const newPrice = ethers.parseUnits("299", 6);
    await subscription.setSubscriptionPrice(newPrice);
    expect(await subscription.subscriptionPrice()).to.equal(newPrice);
  });

  it("should set a user as premium", async () => {
    await subscription.setPremium(user.address, true);
    expect(await subscription.isPremium(user.address)).to.be.true;
  });

  it("should allow owner to withdraw USDC", async () => {
    await usdc.connect(user).approve(subscription.target, subscriptionPrice);
    await subscription.connect(user).subscribe(usdc.target);

    const beforeUsdcBal = await usdc.balanceOf(owner.address);
    await subscription.withdrawUSDC();
    
    const afterUsdcBal = await usdc.balanceOf(owner.address);
    expect(afterUsdcBal - beforeUsdcBal).to.equal(subscriptionPrice);
   });

   it("should allow owner to withdraw USDT", async () => {
    await usdt.connect(user).approve(subscription.target, subscriptionPrice);
    await subscription.connect(user).subscribe(usdt.target);

    const beforeUsdtBal = await usdt.balanceOf(owner.address);
    await subscription.withdrawUSDT();

    const afterUsdtBal = await usdt.balanceOf(owner.address);
    expect(afterUsdtBal - beforeUsdtBal).to.equal(subscriptionPrice);
   });
});