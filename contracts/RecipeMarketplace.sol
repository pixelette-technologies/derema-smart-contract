// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC721A } from "erc721a/contracts/IERC721A.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { ERC2981Upgradeable } from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @dev Interface for the RecipeNFT contract, extending the IERC721A standard.
 */
interface IRecipeNFT is IERC721A {
    function isPaidUser(address user) external view returns (bool);
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256);
}

/**
 * @title Mattia Marketplace Contract
 * @author Pixellete Tech
 * @notice This contract manages the marketplace functionality for listing, buying, and managing Recipe NFTs.
 * @dev Implements marketplace logic including listing control, pricing, and royalty-aware transfers
 */
contract RecipeMarketplace is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /**
     * @dev Represents an NFT listing with price, seller, and accepted payment token.
     */
    struct Listing {
        uint256 price;
        address seller;
        address paymentToken;
    }

    /**
     * @dev Maximum number of active NFT listings allowed on the marketplace.
     */ 
    uint256 private constant MAX_LISTINGS = 300;

    /**
     * @dev Reference to the RecipeNFT contract used for ownership and metadata validation.
     */
    IRecipeNFT public recipeNFT;

    /**
     * @dev USDC token contract used as one of the accepted payment tokens.
     */
    IERC20 public usdcToken;

    /**
     * @dev USDT token contract used as one of the accepted payment tokens.
     */
    IERC20 public usdtToken;

    /**
     * @dev Maps each token ID to its active marketplace listing.
     */
    mapping(uint256 => Listing) public listings;

    /**
     * @dev Tracks which ERC20 tokens are allowed for purchasing NFTs.
     */
    mapping(address => bool) public allowedPaymentTokens;

    /**
     * @dev Storage gap for future upgrades
     * @custom:oz-upgrades-unsafe-allow state-variable-immutable
     * state-variable-assignment 
     */ 
    uint256[50] private __gap;

    event RecipeListed(uint256 indexed tokenId, address indexed owner, uint256 price, address paymentToken);
    event RecipeCancelled(address indexed owner, uint256 indexed tokenId);
    event RecipeSold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, address paymentToken, uint256 royalty);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _recipeNFT,
        address _usdc,
        address _usdt
    ) public initializer {
        require(_recipeNFT != address(0), "Invalid NFT address");
        require(_usdc != address(0), "Invalid USDC address");
        require(_usdt != address(0), "Invalid USDT address");

        recipeNFT = IRecipeNFT(_recipeNFT);
        usdcToken = IERC20(_usdc);
        usdtToken = IERC20(_usdt);

        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();  // Initialize UUPSUpgradeable

        allowedPaymentTokens[_usdc] = true;
        allowedPaymentTokens[_usdt] = true;

        require(recipeNFT.supportsInterface(type(ERC2981Upgradeable).interfaceId), "NFT does not support ERC2981");
    }

    modifier onlyPaidUser() {
        require(recipeNFT.isPaidUser(msg.sender), "Not a paid user");
        _;
    }

    modifier notListed(uint256 _tokenId) {
        require(listings[_tokenId].price == 0, "Already listed");
        _;
    }

    modifier isListed(uint256 _tokenId) {
        require(listings[_tokenId].price > 0, "Not listed");
        _;
    }

    /**
     * @dev Lists a recipe for sale on the marketplace for subscribed users.
     * @param _tokenId Token ID of the recipe to list.
     * @param _price Price of the recipe.
     * @param _paymentToken The address of the payment token (USDC or USDT).
     */
    function listRecipe(uint256 _tokenId, uint256 _price, address _paymentToken) external whenNotPaused onlyPaidUser notListed(_tokenId) {
        require(recipeNFT.ownerOf(_tokenId) == msg.sender, "Not owner");
        require(_price > 0, "Price must be greater than 0");
        require(allowedPaymentTokens[_paymentToken], "Unsupported payment token");
        require(
            recipeNFT.getApproved(_tokenId) == address(this) || recipeNFT.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        (, uint256 royaltyAmount) = recipeNFT.royaltyInfo(_tokenId, _price);
        require(royaltyAmount <= _price, "Royalty exceeds price");

        listings[_tokenId] = Listing(_price, msg.sender, _paymentToken);

        emit RecipeListed(_tokenId, msg.sender, _price, _paymentToken);
    }
    
    /**
     * @dev Lists a batch of recipes for sale on the marketplace for subscribed users.
     * @param tokenIds Token IDs of the batch recipies to list.
     * @param price Price for each.
     * @param paymentToken The address of the payment token (USDC or USDT).
     */

    function batchListRecipes(uint256[] calldata tokenIds, uint256 price, address paymentToken) external whenNotPaused onlyPaidUser {
        require(tokenIds.length <= MAX_LISTINGS, "exceeds max listing of 300");
        require(price > 0, "Price must be > 0");
        require(allowedPaymentTokens[paymentToken], "Unsupported token");
        require( recipeNFT.isApprovedForAll(msg.sender, address(this)), "Marketplace not approved");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            if (recipeNFT.ownerOf(tokenId) != msg.sender || listings[tokenId].price != 0) {
                continue;
            }
            listings[tokenId] = Listing(price, msg.sender, paymentToken);
            emit RecipeListed(tokenId, msg.sender, price, paymentToken);
        }
    }

    /**
     * @dev Allows any user, whether subscribed or not, to buy a listed recipe.
     * @param _tokenId Token ID of the recipe to buy.
     */
    function buyRecipe(uint256 _tokenId, uint256 expectedPrice) external whenNotPaused nonReentrant isListed(_tokenId) {
        Listing memory listedItem = listings[_tokenId];
        require(listedItem.price == expectedPrice, "Price has changed");

        uint256 price = listedItem.price;

        IERC20 payToken = IERC20(listedItem.paymentToken);
        (address royaltyReceiver, uint256 royaltyAmount) = recipeNFT.royaltyInfo(_tokenId, price);

        delete listings[_tokenId];

        if (royaltyAmount > 0) {
            payToken.safeTransferFrom(msg.sender, royaltyReceiver, royaltyAmount);
        }

        payToken.safeTransferFrom(msg.sender, listedItem.seller, price - royaltyAmount);

        recipeNFT.safeTransferFrom(listedItem.seller, msg.sender, _tokenId);

        emit RecipeSold(_tokenId, msg.sender, listedItem.seller, price, listedItem.paymentToken, royaltyAmount);
    }
    
    /**
     * @dev Allows the recipe owner to cancel a listing.
     * @param _tokenId Token ID of the recipe to cancel.
     */
    function cancelListing(uint256 _tokenId) external whenNotPaused isListed(_tokenId) {
        require(recipeNFT.ownerOf(_tokenId) == msg.sender, "Not the owner");
        delete listings[_tokenId];
        emit RecipeCancelled(msg.sender, _tokenId);
    }

    /**
     * @notice Pauses the contract, preventing certain functions from being executed.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract, allowing functions to be executed again.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Required function for UUPSUpgradeable to restrict upgraded to only owner.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(newImplementation != address(0), "Invalid address");
    }
}
