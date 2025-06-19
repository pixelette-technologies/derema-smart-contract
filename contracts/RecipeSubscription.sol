// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title Subscription
 * @dev Manages user subscriptions for the platform
 */
contract RecipeSubscription is Initializable, PausableUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {

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
     * @notice Subscription price in USDC & USDT
     */
    uint256 public subscriptionPrice = 10000; // for mainnet it is (199 * 10**6)

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
    event SubscriptionPriceUpdated(uint256 oldPrice, uint256 newPrice);

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
    }

    modifier subscriptionNotExpired() {
        SubscriptionDetails storage sub = subscriptions[msg.sender];
        require(sub.isCancelled || block.timestamp > sub.endTime, "Subscription is still active");
        _;
    }

    /**
     * @dev Allows a user to subscribe for the service
     */
    function subscribe(address _paymentToken) external nonReentrant whenNotPaused subscriptionNotExpired {
        require(_paymentToken == address(usdcToken) || _paymentToken == address(usdtToken), "Invalid payment token");

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + SUBSCRIPTION_DURATION;

        subscriptions[msg.sender] = SubscriptionDetails({
            startTime: startTime,
            endTime: endTime,
            isSubscribed: true,
            isCancelled: false
        });

        require(
            IERC20(_paymentToken).transferFrom(msg.sender, address(this), subscriptionPrice),
            "Transfer failed"
        );

        emit SubscriptionPurchased(msg.sender, startTime, endTime);
    }

    /**
     * @dev Allows owner to update subscription price
     * @param newPrice New price in USDC
     */
    function setSubscriptionPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Invalid price");
        uint256 oldPrice = subscriptionPrice;
        subscriptionPrice = newPrice;
        emit SubscriptionPriceUpdated(oldPrice, newPrice);
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
     * @dev Allows owner to cancel a user subscription
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
     * @dev Allows owner to withdraw collected USDC
     */
    function withdrawUSDC() external onlyOwner {
        uint256 usdcBalance = usdcToken.balanceOf(address(this));
        usdcToken.transfer(owner(), usdcBalance);
    }

     /**
     * @dev Allows owner to withdraw collected USDT
     */
    function withdrawUSDT() external onlyOwner {
        uint256 usdtBalance = usdtToken.balanceOf(address(this));
        usdtToken.transfer(owner(), usdtBalance);
    }

    /**
     * @dev Required function for UUPSUpgradeable to restrict upgraded to only owner.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(newImplementation != address(0), "Invalid address");
    }
}
