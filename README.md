
# 🍽️ Ecosystem Documentation

## 📄 Overview

The project is a decentralized NFT recipe marketplace allowing users to mint, buy, and sell culinary recipes as NFTs. It supports:

- Paid and free user roles via a subscription model.
- Lazy minting mechanism (NFTs are minted only when bought).
- Royalty support using ERC2981.
- USDC/USDT payments.
- A capped number of copies per recipe.

## 📦 Contracts

### 1. RecipeNFT.sol

ERC721A-based NFT contract representing recipes.

#### Key Features

- **Paid Subscriber Minting**: Paid users can mint NFTs with royalty settings.
- **Lazy Minting**: Recipes listed by creators offchain but minted only upon purchase, function will be called by backend with correct values.
- **Royalty Support**: ERC2981-based royalty support.
- **Creator Tracking**: Each token maps back to its creator for minting and laziy minting.
- **Subscription Check**: Integrated with `ISubscription` interface.

## 🪙 Royalty Logic

- Based on [ERC-2981](https://eips.ethereum.org/EIPS/eip-2981)
- Maximum royalty: 10% (1000 BPS)
- Set during `mintRecipeForPaidUsers()`

## 🖼 Token URI & Metadata

- `tokenURI()` returns a placeholder URI.
- Metadata is handled and set off chain through restrictions from backend.

#### Netspac-style Comments

```solidity
/**
 * @dev Mints a recipe NFT for paid users with royalty support.
 * @param _amount Number of copies to mint.
 * @param _royaltyFeeBps Royalty fee (max 1000 BPS).
 */
function mintRecipeForPaidUsers(uint256 _amount, uint96 _royaltyFeeBps) external onlyPaidSubscriber

/**
 * @dev Lazy mint triggered from marketplace purchase.
 * @param _creator Address of the original creator.
 * @param _amount Number of copies being minted.
 */
function buyLazyMintedRecipe(address _creator, uint256 _amount) external

/**
 * @dev Checks if user is a valid subscriber.
 * @param _user Address of the user to check.
 * @return True if user is subscribed and active or premium.
 */
function isPaidUser(address _user) public view returns (bool)
```

### 2. Subscription.sol (Interface)

This contract validates subscription status.

```solidity
interface ISubscription {
  function subscriptions(address user) external view returns (
    uint256 startTime,
    uint256 endTime,
    bool isSubscribed,
    bool isCancelled
  );

  function isPremium(address user) external view returns (bool);
}
```

### 3. RecipeMarketplace.sol

The marketplace handles buying recipes and payment in USDC/USDT.

#### Key Responsibilities

- Validates whether recipe is listed for sale.
- Uses ERC20 tokens (USDC/USDT) for payments.
- On successful payment, triggers buying.


## 🛠 Deployment & Testing

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test
```

## 🔗 Contract Relationships

```mermaid
graph TD;
  A[User] -->|mint (paid)| B[RecipeNFT]
  A -->|buy recipe| D[Marketplace]
  D -->|lazy mint| B
  B -->|creatorOf| A
  A -->|check subscription| C[Subscription]
  D -->|pay in USDC/USDT| E[Treasury]
```

## ⚠️ Limits & Configurations

- `MAX_COPIES`: 20 (cannot mint more than 20 per recipe)
- Placeholder URI is used for metadata lookup
- Subscription logic is on-chain but also validated off-chain

## 🔒 Access Control

- Only `owner()` can:
  - Update `subscriptionContract`
  - Update placeholder URI

## 👨‍🍳 Roles

| Role         | Capabilities |
|--------------|--------------|
| Paid User    | Mint with royalty, list recipes |
| Free User    | View/buy free recipes only |
| Creator      | Can receive royalties |
| Owner        | Admin tasks (update URI, contracts) |

## 🔁 Lazy Minting Flow

1. Creator lists a recipe (off-chain or via backend).
2. Buyer clicks "buy" on Marketplace.
3. Payment is processed in USDC/USDT.
4. Marketplace calls `buyLazyMintedRecipe()`.
5. NFT is minted directly to buyer.
6. Creator is recorded in `creatorOf[tokenId]`.

## 🧪 Testing Coverage

- Subscription validation edge cases
- Royalty bounds enforcement
- Minting with boundary values (1–20)
- Ownership and URI correctness
- Payment + Lazy Minting integration

---

© 2025 Pixelette — All rights reserved.
