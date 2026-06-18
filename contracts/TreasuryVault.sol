// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TreasuryVault is Ownable, ReentrancyGuard {
    IERC20 public depositToken;
    IERC20 public yieldToken;

    address public agent;
    uint256 public totalDeposited;
    uint256 public maxPerTransaction;
    uint256 public maxDailySpend;

    mapping(uint256 => uint256) public dailySpent;

    event Deposited(address indexed from, uint256 amount);
    event YieldHarvested(uint256 amount);
    event Spent(address indexed to, uint256 amount, string reason);
    event GuardrailsUpdated(uint256 maxPerTx, uint256 maxDaily);
    event AgentUpdated(address indexed agent);

    constructor(
        address _depositToken,
        address _yieldToken,
        address _agent,
        uint256 _maxPerTransaction,
        uint256 _maxDailySpend
    ) Ownable(msg.sender) {
        depositToken = IERC20(_depositToken);
        yieldToken = IERC20(_yieldToken);
        agent = _agent;
        maxPerTransaction = _maxPerTransaction;
        maxDailySpend = _maxDailySpend;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "Not authorized");
        _;
    }

    function deposit(uint256 amount) external onlyOwner {
        require(amount > 0, "Zero deposit");
        depositToken.transferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        emit Deposited(msg.sender, amount);
    }

    function getAvailableYield() public view returns (uint256) {
        uint256 currentBalance = depositToken.balanceOf(address(this));
        if (currentBalance <= totalDeposited) return 0;
        return currentBalance - totalDeposited;
    }

    function harvestYield() external onlyAgent nonReentrant {
        uint256 yield_ = getAvailableYield();
        require(yield_ > 0, "No yield available");
        depositToken.transfer(agent, yield_);
        emit YieldHarvested(yield_);
    }

    function spend(address to, uint256 amount, string calldata reason) external onlyAgent nonReentrant {
        require(amount > 0, "Zero amount");
        require(amount <= maxPerTransaction, "Exceeds transaction limit");

        uint256 today = block.timestamp / 1 days;
        require(dailySpent[today] + amount <= maxDailySpend, "Exceeds daily limit");

        uint256 available = getAvailableYield();
        require(amount <= available, "Insufficient yield");

        dailySpent[today] += amount;
        depositToken.transfer(to, amount);
        emit Spent(to, amount, reason);
    }

    function updateGuardrails(uint256 _maxPerTransaction, uint256 _maxDailySpend) external onlyOwner {
        maxPerTransaction = _maxPerTransaction;
        maxDailySpend = _maxDailySpend;
        emit GuardrailsUpdated(_maxPerTransaction, _maxDailySpend);
    }

    function updateAgent(address _agent) external onlyOwner {
        require(_agent != address(0), "Zero address");
        agent = _agent;
        emit AgentUpdated(_agent);
    }

    function getStatus() external view returns (
        uint256 balance,
        uint256 deposited,
        uint256 availableYield,
        uint256 dailyUsed,
        uint256 maxPerTx,
        uint256 maxDaily
    ) {
        uint256 today = block.timestamp / 1 days;
        return (
            depositToken.balanceOf(address(this)),
            totalDeposited,
            getAvailableYield(),
            dailySpent[today],
            maxPerTransaction,
            maxDailySpend
        );
    }
}
