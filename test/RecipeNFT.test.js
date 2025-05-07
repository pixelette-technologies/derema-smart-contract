const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RecipeNFT Contract", function () {
  let owner, user1, user2;
  let subscriptionContract, recipeNFT, usdc, usdt;
  let subscriptionPrice = ethers.parseUnits("199", 6); // Example price for subscription

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy Mock USDC and USDT Tokens
    const ERC20Mock = await ethers.getContractFactory("MockERC20");
    usdc = await ERC20Mock.deploy("USDC", "USDC");
    usdt = await ERC20Mock.deploy("USDT", "USDT");

    const Subscription = await ethers.getContractFactory("MattiaSubscription");
    subscriptionContract = await Subscription.deploy(usdc.target, usdt.target);

    // Deploy RecipeNFT Contract
    const RecipeNFT = await ethers.getContractFactory("RecipeNFT");
    recipeNFT = await RecipeNFT.deploy(subscriptionContract.target, "https://example.com");

		await usdc.mint(user1.address, ethers.parseUnits("10000", 6));
    await usdc.mint(user2.address, ethers.parseUnits("10000", 6));

    await usdc.connect(user1).approve(subscriptionContract.target, subscriptionPrice);
    await usdc.connect(user2).approve(subscriptionContract.target, subscriptionPrice);

    await subscriptionContract.connect(user1).subscribe(usdc.target);
  });

  describe("Minting Recipes", function () {
    it("should mint a recipe for paid users", async function () {
      const royaltyFee = 500; // 5% royalty
      const mintAmount = 1;

      await recipeNFT.connect(user1).mintRecipeForPaidUsers(mintAmount, royaltyFee);

      const balance = await recipeNFT.balanceOf(user1.address);
      expect(balance).to.equal(mintAmount);

      const creator = await recipeNFT.creatorOf(0);
      expect(creator).to.equal(user1.address);
    });

    it("should not allow non-subscribed users to mint", async function () {
      const royaltyFee = 500; // 5% royalty
      const mintAmount = 1;

      await expect(
        recipeNFT.connect(user2).mintRecipeForPaidUsers(mintAmount, royaltyFee)
      ).to.be.revertedWith("Subscription invalid or expired");
    });

    it("should not mint more than the maximum allowed copies", async function () {
      const royaltyFee = 500; // 5% royalty
      const mintAmount = 21;

      await expect(
        recipeNFT.connect(user1).mintRecipeForPaidUsers(mintAmount, royaltyFee)
      ).to.be.revertedWith("Must mint between 1 and 21 copies");
    });
  });

  describe("Lazy Minting", function () {
		it("should allow lazy minting by a buyer", async function () {
			await recipeNFT.connect(user1).buyLazyMintedRecipe(user2.address, 1);

			expect(await recipeNFT.ownerOf(0)).to.equal(user1.address);
			expect(await recipeNFT.creatorOf(0)).to.equal(user2.address);
		});
	});
	
	describe("Admin Controls", function () {
		it("should allow owner to update the placeholder URI", async function () {
			const royaltyFee = 500; // 5% royalty
      const mintAmount = 1;

			await recipeNFT.connect(user1).mintRecipeForPaidUsers(mintAmount, royaltyFee)
			await recipeNFT.connect(owner).updatePlaceholderURI("https://new-uri.com");
			expect(await recipeNFT.tokenURI(0)).to.equal("https://new-uri.com");
		});
	
		it("should prevent non-owners from updating the placeholder URI", async function () {
			await expect(
				recipeNFT.connect(user1).updatePlaceholderURI("https://hacked.com")
			).to.be.revertedWithCustomError(recipeNFT, "OwnableUnauthorizedAccount");
		});
	});
	
	describe("Royalties", function () {
		it("should return correct royalty info", async function () {
			const royaltyFee = 500; // 5%
			await recipeNFT.connect(user1).mintRecipeForPaidUsers(1, royaltyFee);
	
			const [receiver, amount] = await recipeNFT.royaltyInfo(0, 10000);
			expect(receiver).to.equal(user1.address);
			expect(amount).to.equal(500); // 5% 
		});
	
		it("should revert if royalty fee exceeds max", async function () {
			const invalidRoyaltyFee = 1500;
	
			await expect(
				recipeNFT.connect(user1).mintRecipeForPaidUsers(1, invalidRoyaltyFee)
			).to.be.revertedWith("Royalty fee exceeds max 10%");
		});
	});
	
	describe("Edge Cases", function () {
		it("should revert if mint amount is 0", async function () {
			await expect(
				recipeNFT.connect(user1).mintRecipeForPaidUsers(0, 200)
			).to.be.revertedWith("Must mint between 1 and 21 copies");
		});
	
		it("should revert for token URI access of nonexistent token", async function () {
			await expect(recipeNFT.tokenURI(99)).to.be.revertedWith("Token does not exist");
		});
	});
});

