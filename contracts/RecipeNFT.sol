// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ERC721A } from "erc721a/contracts/ERC721A.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";

interface ISubscription {
    function subscriptions(address user) external view returns (
        uint256 startTime,
        uint256 endTime,
        bool isSubscribed,
        bool isCancelled
    );

    function isPremium(address user) external view returns (bool);
}

/**
 * @title RecipeNFT
 * @dev A contract for minting, managing, and interacting with Recipe NFTs.
 */
contract RecipeNFT is ERC721A, Ownable, ERC2981 {
    uint256 private constant ROYALTY_FEE_MAX_BPS = 1000;
    uint256 private constant MAX_COPIES = 300;

    string private placeholderURI;
    address public subscriptionContract;

    mapping(uint256 => address) public creatorOf;

    event RecipeMinted(address indexed user, uint256 indexed startTokenId, uint256 count);
    event SubscriptionContractUpdated(address indexed newSubscriptionContract);
    event PlaceholderURIUpdated(string newURI);
     
    /**
     * @dev Constructor to initialize the contract with subscription contract, and placeholder URI.
     * @param _subscriptionContract Address of the subscription contract.
     * @param _URI Placeholder URI for the Recipe NFTs.
     */
    constructor(address _subscriptionContract, string memory _URI)
        ERC721A("RecipeNFT", "RCP")
        Ownable(msg.sender)
    {
        require(_subscriptionContract != address(0), "Invalid subscription contract");
        subscriptionContract = _subscriptionContract;
        placeholderURI = _URI;
    }

    modifier onlyPaidSubscriber() {
        ISubscription sub = ISubscription(subscriptionContract);
        (, uint256 endTime, bool isSubbed, bool isCancelled) = sub.subscriptions(msg.sender);
        bool isPremium = sub.isPremium(msg.sender);
        require((isSubbed && !isCancelled && block.timestamp <= endTime) || isPremium, "Subscription invalid or expired");
        _;
    }
    
    /**
     * @dev Allows paid users to mint a specified number of recipes with a royalty fee.
     * @param _amount Number of copies to mint.
     * @param _royaltyFeeBps Royalty fee in basis points (100 basis points = 1%).
     */
    function mintRecipeForPaidUsers(uint256 _amount, uint96 _royaltyFeeBps) external onlyPaidSubscriber {
        require(_royaltyFeeBps <= ROYALTY_FEE_MAX_BPS, "Royalty fee exceeds max 10%");
        require(_amount > 0 && _amount <= MAX_COPIES, "Must mint between 1 and 300 copies");

        uint256 startTokenId = _nextTokenId();
        for (uint256 i = 0; i < _amount; i++) {
            creatorOf[startTokenId + i] = msg.sender;
            _setTokenRoyalty(startTokenId + i, msg.sender, _royaltyFeeBps);
        }

        _safeMint(msg.sender, _amount);
        emit RecipeMinted(msg.sender, startTokenId, _amount);
    }
    
    /**
     * @dev Allows users to buy lazy-minted recipes directly from the creator.
     * @param _creator The creator of the recipe.
     * @param _amount The number of copies to mint.
     */
    function buyLazyMintedRecipe(address _creator, uint256 _amount) external {
        require(_amount > 0 && _amount < MAX_COPIES, "Must mint between 1 and 21 copies");
        require(_creator != address(0), "Invalid address");

        uint256 startTokenId = _nextTokenId();

        for (uint256 i = 0; i < _amount; i++) {
            creatorOf[startTokenId + i] = _creator;
        }

        _safeMint(msg.sender, _amount);

        emit RecipeMinted(msg.sender, startTokenId, _amount);
    }
    
    /**
     * @dev Checks if a user is a paid subscriber.
     * @param _user The address of the user to check.
     * @return True if the user is a paid subscriber or premium, false otherwise.
     */
    function isPaidUser(address _user) public view returns (bool) {
        ISubscription sub = ISubscription(subscriptionContract);
        (, uint256 endTime, bool isSubbed, bool isCancelled) = sub.subscriptions(_user);
        bool isPremium = sub.isPremium(_user);
        return (isSubbed && !isCancelled && block.timestamp <= endTime) || isPremium;
    }
    
    /**
     * @dev Updates the subscription contract address.
     * @param newContract The new address of the subscription contract.
     */
    function updateSubscriptionContract(address newContract) external onlyOwner {
        require(newContract != address(0), "Invalid address");
        subscriptionContract = newContract;
        emit SubscriptionContractUpdated(newContract);
    }
    
    /**
     * @dev Updates the placeholder URI for the Recipe NFTs.
     * @param newURI The new placeholder URI.
     */
    function updatePlaceholderURI(string calldata newURI) external onlyOwner {
        placeholderURI = newURI;
        emit PlaceholderURIUpdated(newURI);
    }
    
    /**
     * @dev Returns the URI of a given token.
     * @param tokenId The token ID to fetch the URI for.
     * @return The URI of the token.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return placeholderURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721A, ERC2981)
        returns (bool)
    {
        return interfaceId == type(ERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}
