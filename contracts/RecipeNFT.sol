// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ERC721AUpgradeable } from "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { ERC2981Upgradeable } from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

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
contract RecipeNFT is Initializable, ERC721AUpgradeable, OwnableUpgradeable, PausableUpgradeable, ERC2981Upgradeable, UUPSUpgradeable {
    uint256 private constant ROYALTY_FEE_MAX_BPS = 1000;
    uint256 private constant MAX_COPIES = 300;

    string private placeholderURI;
    address public subscriptionContract;

    mapping(uint256 => address) public creatorOf;

    /**
     * @dev Storage gap for future upgrades
     * @custom:oz-upgrades-unsafe-allow state-variable-immutable
     * state-variable-assignment 
     */ 
    uint256[50] private __gap;

    event RecipeMinted(address indexed user, uint256 indexed startTokenId, uint256 count);
    event SubscriptionContractUpdated(address indexed newSubscriptionContract);
    event PlaceholderURIUpdated(string newURI);

     /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _subscriptionContract,
        string memory _URI
    ) public initializer {
        require(_subscriptionContract != address(0), "Invalid subscription contract");

        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();  // Initialize UUPSUpgradeable

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
    function mintRecipeForPaidUsers(uint256 _amount, uint96 _royaltyFeeBps) external whenNotPaused onlyPaidSubscriber {
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
    function buyLazyMintedRecipe(address _creator, uint256 _amount) external whenNotPaused {
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

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721AUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return interfaceId == type(ERC2981Upgradeable).interfaceId || super.supportsInterface(interfaceId);
    }
}
