// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title Mattia Subscription Contract
 * @author Pixellete Tech
 * @notice This contract manages user subscriptions for the Mattia NFT marketplace, supporting payments in USDT and USDC
 * @dev Handles subscription logic,
 */
contract RecipeSubscription is Initializable, PausableUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /**
     * @notice Struct to represent a user's active subscription
     * @dev Tracks subscription time, duration and status
     */
    struct SubscriptionDetails {
        uint256 startTime;
        uint256 endTime;
        bool isSubscribed;
        bool isCancelled;
    }

    uint256 public constant SUBSCRIPTION_DURATION = 365 days;

    /**
     * @notice The ERC20 tokens that users can use for payments
     */
    IERC20 public usdcToken;
    IERC20 public usdtToken;
 
    /**
     * @notice Subscription prices in USDC & USDT
     */
    uint256 public usdcPrice;
    uint256 public usdtPrice;

    /**
     * @notice Mapping of user addresses to their subscription details
     */
    mapping(address => SubscriptionDetails) public subscriptions;

    /**
     * @notice Mapping of approved premium addresses
     */
    mapping(address => bool) public isPremium;

    /**
     * @dev Storage gap for future upgrades
     * @custom:oz-upgrades-unsafe-allow state-variable-immutable
     * state-variable-assignment 
     */ 
    uint256[50] private __gap;


    event SubscriptionPurchased(address indexed user, uint256 startTime, uint256 endTime);
    event SubscriptionRenewed(address indexed user, uint256 startTime, uint256 newEndTime);
    event SubscriptionCancelled(address indexed user, uint256 cancellationTime);
    event SubscriptionPriceUpdated(address indexed token, uint256 oldPrice, uint256 newPrice);
    event TokenWithdrawn(address indexed token, uint256 amount, address indexed to);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _usdcToken,
        address _usdtToken
    ) public initializer {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_usdtToken != address(0), "Invalid USDT address");

        __Pausable_init();
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        usdcToken = IERC20(_usdcToken);
        usdtToken = IERC20(_usdtToken);
        usdcPrice = 199 * 10**6;
        usdtPrice = 199 * 10**18;
    }

    modifier subscriptionNotExpired() {
        SubscriptionDetails storage sub = subscriptions[msg.sender];
        require(sub.isCancelled || block.timestamp > sub.endTime, "Subscription is still active");
        _;
    }

    /**
     * @dev Allows a user to subscribe for the service using USDC or USDT.
     */
    function subscribe(address _paymentToken) external nonReentrant whenNotPaused subscriptionNotExpired {
        require(_paymentToken == address(usdcToken) || _paymentToken == address(usdtToken), "Invalid payment token");

        uint256 price;
        if (_paymentToken == address(usdcToken)) {
            price = usdcPrice;
        } else {
            price = usdtPrice;
        }

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + SUBSCRIPTION_DURATION;

        subscriptions[msg.sender] = SubscriptionDetails({
            startTime: startTime,
            endTime: endTime,
            isSubscribed: true,
            isCancelled: false
        });

        IERC20(_paymentToken).safeTransferFrom(msg.sender, address(this), price);

        emit SubscriptionPurchased(msg.sender, startTime, endTime);
    }

    /**
     * @dev Allows owner to update subscription price
     * @param newPrice New price in USDC
     */
    function setUsdcPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Invalid price");
        uint256 oldPrice = usdcPrice;
        usdcPrice = newPrice;
        emit SubscriptionPriceUpdated(address(usdcToken), oldPrice, newPrice);
    }


    /**
     * @dev Allows owner to update subscription price
     * @param newPrice New price in USDT
     */
    function setUsdtPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Invalid price");
        uint256 oldPrice = usdtPrice;
        usdtPrice = newPrice;
        emit SubscriptionPriceUpdated(address(usdtToken), oldPrice, newPrice);
    }
    
    /**
     * @dev Allows owner to make a user address premium
     * @param _user The address of the user
     * @param _status The premium status to set (true or false)
     */
    function setPremium(address _user, bool _status) external onlyOwner {
      isPremium[_user] = _status;
    }
    
    /**
     * @dev Allows owner to cancel a user subscription if required
     * @param _user user address
     */
    function cancelSubscription(address _user) external onlyOwner {
        SubscriptionDetails storage sub = subscriptions[_user];
        require(sub.isSubscribed, "Not subscribed");
        require(!sub.isCancelled, "Already cancelled");

        sub.endTime = 0;
        sub.isCancelled = true;
        emit SubscriptionCancelled(_user, block.timestamp);
    }

    /**
     * @dev Allows owner to pause subscriptions
     */
    function pauseSubscriptions() external onlyOwner {
        _pause();
    }

    /**
     * @dev Allows owner to unpause subscriptions
     */
    function unpauseSubscriptions() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Allows the owner to withdraw any ERC20 tokens held by the contract,
     *      including USDC and USDT. Emits a TokenWithdrawn event.
     * @param _token The ERC20 token address to withdraw.
     */

    function withdrawToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid Token");
        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");

        IERC20(_token).safeTransfer(owner(), balance);
        emit TokenWithdrawn(_token, balance, owner());
    }


    /**
     * @dev Required function for UUPSUpgradeable to restrict upgraded to only owner.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(newImplementation != address(0), "Invalid address");
    }
}
