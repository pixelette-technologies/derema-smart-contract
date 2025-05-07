// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC721A } from "erc721a/contracts/IERC721A.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";

interface IRecipeNFT is IERC721A {
    function isPaidUser(address user) external view returns (bool);
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256);
}

contract RecipeMarketplace is Ownable, ReentrancyGuard {
    struct Listing {
        uint256 price;
        address seller;
        address paymentToken;
    }

    mapping(uint256 => Listing) public listings;
    mapping(address => bool) public allowedPaymentTokens;

    IRecipeNFT public immutable recipeNFT;
    IERC20 public immutable usdcToken;
    IERC20 public immutable usdtToken;

    event RecipeListed(uint256 indexed tokenId, address indexed owner, uint256 price, address paymentToken);
    event RecipeCancelled(address indexed owner, uint256 indexed tokenId);
    event RecipeSold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, address paymentToken, uint256 royalty);

    /**
     * @dev Constructor to initialize the contract with RecipeNFT, USDC, and USDT addresses.
     * @param _recipeNFT Address of the RecipeNFT contract.
     * @param _usdc Address of the USDC token.
     * @param _usdt Address of the USDT token.
     */
    constructor(address _recipeNFT, address _usdc, address _usdt)
        Ownable(msg.sender)
    {
        require(_recipeNFT != address(0), "Invalid NFT address");
        require(_usdc != address(0), "Invalid USDC address");
        require(_usdt != address(0), "Invalid USDT address");

        recipeNFT = IRecipeNFT(_recipeNFT);
        usdcToken = IERC20(_usdc);
        usdtToken = IERC20(_usdt);

        allowedPaymentTokens[_usdc] = true;
        allowedPaymentTokens[_usdt] = true;

        require(recipeNFT.supportsInterface(type(ERC2981).interfaceId), "NFT does not support ERC2981");
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
    function listRecipe(uint256 _tokenId, uint256 _price, address _paymentToken) external onlyPaidUser notListed(_tokenId) {
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
     * @dev Allows a subscribed user to buy a listed recipe.
     * @param _tokenId Token ID of the recipe to buy.
     */
    function buyRecipe(uint256 _tokenId) external onlyPaidUser nonReentrant isListed(_tokenId) {
        Listing memory listedItem = listings[_tokenId];
        uint256 price = listedItem.price;

        IERC20 payToken = IERC20(listedItem.paymentToken);
        (address royaltyReceiver, uint256 royaltyAmount) = recipeNFT.royaltyInfo(_tokenId, price);

        delete listings[_tokenId];

        if (royaltyAmount > 0) {
            require(payToken.transferFrom(msg.sender, royaltyReceiver, royaltyAmount), "Royalty transfer failed");
        }

        require(payToken.transferFrom(msg.sender, listedItem.seller, price - royaltyAmount), "Seller payment failed");

        recipeNFT.safeTransferFrom(listedItem.seller, msg.sender, _tokenId);

        emit RecipeSold(_tokenId, msg.sender, listedItem.seller, price, listedItem.paymentToken, royaltyAmount);
    }
    
    /**
     * @dev Allows the recipe owner to cancel a listing.
     * @param _tokenId Token ID of the recipe to cancel.
     */
    function cancelListing(uint256 _tokenId) external isListed(_tokenId) {
        require(recipeNFT.ownerOf(_tokenId) == msg.sender, "Not the owner");
        delete listings[_tokenId];
        emit RecipeCancelled(msg.sender, _tokenId);
    }

    /**
     * @dev Allows the recipe owner to update a listing's price and payment token.
     * @param _tokenId Token ID of the recipe to update.
     * @param _newPrice New price of the recipe.
     * @param _paymentToken New payment token (USDC or USDT).
     */
    function updateListing(uint256 _tokenId, uint256 _newPrice, address _paymentToken) external isListed(_tokenId) {
        require(recipeNFT.ownerOf(_tokenId) == msg.sender, "Not the owner");
        require(_newPrice > 0, "Price must be greater than 0");
        require(allowedPaymentTokens[_paymentToken], "Unsupported token");

        listings[_tokenId].price = _newPrice;
        listings[_tokenId].paymentToken = _paymentToken;

        emit RecipeListed(_tokenId, msg.sender, _newPrice, _paymentToken);
    }
}
