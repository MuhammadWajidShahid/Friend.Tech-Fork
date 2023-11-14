// SPDX-License-Identifier: MIT

pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// File: contracts/FriendtechShares.sol

// TODO: Events, final pricing model,

contract FriendtechSharesV1 is Ownable {
    IERC20 public immutable fundToken;

    address public protocolFeeDestination;
    address public protocolBFeeDestination;
    uint256 public protocolFeePercent = 4 * 1e18; // 4% fee to party A
    uint256 public protocolBFeePercent = 4 * 1e18; // 4% fee to party B
    uint256 public subjectFeePercent = 2 * 1e18; // 2% fee to party C

    event Trade(
        address trader,
        address subject,
        bool isBuy,
        uint256 shareAmount,
        uint256 ethAmount,
        uint256 protocolEthAmount,
        uint256 protocolBEthAmount,
        uint256 subjectEthAmount,
        uint256 supply
    );

    // SharesSubject => (Holder => Balance)
    mapping(address => mapping(address => uint256)) public sharesBalance;

    // SharesSubject => Supply
    mapping(address => uint256) public sharesSupply;

    constructor(address _fundToken) {
        require(_fundToken != address(0x0), "zero-address-not-allowed");
        fundToken = IERC20(_fundToken);
    }

    function setFeeDestination(address _feeDestination) public onlyOwner {
        protocolFeeDestination = _feeDestination;
    }

    function setFeeBDestination(address _feeBDestination) public onlyOwner {
        protocolBFeeDestination = _feeBDestination;
    }

    function setProtocolFeePercent(uint256 _feePercent) public onlyOwner {
        protocolFeePercent = _feePercent;
    }

    function setProtocolBFeePercent(uint256 _feePercent) public onlyOwner {
        protocolBFeePercent = _feePercent;
    }

    function setSubjectFeePercent(uint256 _feePercent) public onlyOwner {
        subjectFeePercent = _feePercent;
    }

    function getPrice(
        uint256 supply,
        uint256 amount
    ) public pure returns (uint256) {
        uint256 sum1 = supply == 0
            ? 0
            : ((supply - 1) * (supply) * (2 * (supply - 1) + 1)) / 6;
        uint256 sum2 = supply == 0 && amount == 1
            ? 0
            : ((supply - 1 + amount) *
                (supply + amount) *
                (2 * (supply - 1 + amount) + 1)) / 6;
        uint256 summation = sum2 - sum1;
        return (summation * 1 ether) / 16000;
    }

    function getBuyPrice(
        address sharesSubject,
        uint256 amount
    ) public view returns (uint256) {
        return getPrice(sharesSupply[sharesSubject], amount);
    }

    function getSellPrice(
        address sharesSubject,
        uint256 amount
    ) public view returns (uint256) {
        return getPrice(sharesSupply[sharesSubject] - amount, amount);
    }

    function getBuyPriceAfterFee(
        address sharesSubject,
        uint256 amount
    ) public view returns (uint256) {
        uint256 price = getBuyPrice(sharesSubject, amount);
        uint256 protocolFee = (price * protocolFeePercent) / 1 ether;
        uint256 protocolBFee = (price * protocolBFeePercent) / 1 ether;
        uint256 subjectFee = (price * subjectFeePercent) / 1 ether;
        return price + protocolFee + protocolBFee + subjectFee;
    }

    function getSellPriceAfterFee(
        address sharesSubject,
        uint256 amount
    ) public view returns (uint256) {
        uint256 price = getSellPrice(sharesSubject, amount);
        uint256 protocolFee = (price * protocolFeePercent) / 1 ether;
        uint256 protocolBFee = (price * protocolBFeePercent) / 1 ether;
        uint256 subjectFee = (price * subjectFeePercent) / 1 ether;
        return price - protocolFee - protocolBFee - subjectFee;
    }

    function buyShares(address sharesSubject, uint256 amount) public payable {
        uint256 supply = sharesSupply[sharesSubject];
        require(
            supply > 0 || sharesSubject == msg.sender,
            "Only the shares' subject can buy the first share"
        );
        uint256 price = getPrice(supply, amount);
        uint256 protocolFee = (price * protocolFeePercent) / 1 ether;
        uint256 protocolBFee = (price * protocolBFeePercent) / 1 ether;
        uint256 subjectFee = (price * subjectFeePercent) / 1 ether;
        require(
            msg.value >= price + protocolFee + subjectFee,
            "Insufficient payment"
        );
        sharesBalance[sharesSubject][msg.sender] =
            sharesBalance[sharesSubject][msg.sender] +
            amount;
        sharesSupply[sharesSubject] = supply + amount;
        emit Trade(
            msg.sender,
            sharesSubject,
            true,
            amount,
            price,
            protocolFee,
            protocolBFee,
            subjectFee,
            supply + amount
        );
        (bool success1, ) = protocolFeeDestination.call{value: protocolFee}("");
        (bool success2, ) = protocolBFeeDestination.call{value: protocolBFee}(
            ""
        );
        (bool success3, ) = sharesSubject.call{value: subjectFee}("");
        require(success1 && success2 && success3, "Unable to send funds");
    }

    function sellShares(address sharesSubject, uint256 amount) public payable {
        uint256 supply = sharesSupply[sharesSubject];
        require(supply > amount, "Cannot sell the last share");
        uint256 price = getPrice(supply - amount, amount);
        uint256 protocolFee = (price * protocolFeePercent) / 1 ether;
        uint256 protocolBFee = (price * protocolBFeePercent) / 1 ether;
        uint256 subjectFee = (price * subjectFeePercent) / 1 ether;
        require(
            sharesBalance[sharesSubject][msg.sender] >= amount,
            "Insufficient shares"
        );
        sharesBalance[sharesSubject][msg.sender] =
            sharesBalance[sharesSubject][msg.sender] -
            amount;
        sharesSupply[sharesSubject] = supply - amount;
        emit Trade(
            msg.sender,
            sharesSubject,
            false,
            amount,
            price,
            protocolFee,
            protocolBFee,
            subjectFee,
            supply - amount
        );
        (bool success1, ) = msg.sender.call{
            value: price - protocolFee - subjectFee
        }("");
        (bool success2, ) = protocolFeeDestination.call{value: protocolFee}("");
        (bool success3, ) = protocolBFeeDestination.call{value: protocolBFee}(
            ""
        );
        (bool success4, ) = sharesSubject.call{value: subjectFee}("");
        require(
            success1 && success2 && success3 && success4,
            "Unable to send funds"
        );
    }
}
