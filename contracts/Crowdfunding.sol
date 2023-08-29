// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;


contract Crowdfunding {

    struct Campaign {
        address payable owner;
        string title;
        uint256 goalAmount;
        uint256 deadline; //timestamp
        uint256 raisedAmount;
        mapping (address  => uint256) pledgers;
        uint256 numberOfPledgers;
    }


    mapping (uint256 => Campaign) private campaigns;
    uint256 currentId;
    address public contractOwner;

    constructor() {
        currentId = 0;
        contractOwner = msg.sender;
    }

    event CampaignCreated(uint256 campaignId,address indexed owner, string title, uint256 goalAmount, uint256 deadline);

    event Pledged(address indexed pledger, uint256 campaignId, uint256 amount);


    modifier canRefund(uint256 _campaignId){
        Campaign storage campaign = campaigns[_campaignId];
        
        require(
            block.timestamp < campaign.deadline || 
            (block.timestamp >= campaign.deadline && campaign.goalAmount > campaign.raisedAmount),
            "Cannot refund now"
        );
        _;
    
    }


    function createCampaign(address payable _owner, string memory _title, uint256 _goalAmount, uint256 _deadline) public {
        require(_goalAmount > 0, "Campaign goal has to be >0");
        require(_deadline > block.timestamp, "Incorrect deadline!");
        Campaign storage campaign = campaigns[currentId];
        campaign.owner = _owner;
        campaign.title = _title;
        campaign.goalAmount = _goalAmount;
        campaign.deadline = _deadline;
        campaign.numberOfPledgers = 0;

        currentId += 1;
        emit CampaignCreated(currentId-1, _owner, _title, _goalAmount, _deadline);
    }


    function pledge(uint256 _campaignId) public payable { 
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.value > 0, "Pledge has to be >0");
        require(block.timestamp < campaign.deadline, "Campaign has reached deadline!");
        bool hasPledged = campaign.pledgers[msg.sender] !=0;

        campaign.pledgers[msg.sender] += msg.value;
        campaign.raisedAmount += msg.value;

        if(!hasPledged){
            campaign.numberOfPledgers += 1;
        }

        emit Pledged(msg.sender, _campaignId, msg.value);
    }

    function withdrawPledge(uint256 _campaignId) public canRefund(_campaignId){ 
        Campaign storage campaign = campaigns[_campaignId];
        uint256 pledgedAmount = campaign.pledgers[msg.sender];

        require(pledgedAmount > 0, "You have not pledged any funds to the campaign!");

        campaign.pledgers[msg.sender] = 0;
        campaign.numberOfPledgers -=1;
        campaign.raisedAmount -= pledgedAmount;
        payable(msg.sender).transfer(pledgedAmount);
    }

    // Overload for withdraw amount
    function withdrawPledge(uint256 _campaignId, uint256 withdrawAmount) public canRefund(_campaignId){
        Campaign storage campaign = campaigns[_campaignId];
        uint256 pledgedAmount = campaign.pledgers[msg.sender];

        require(pledgedAmount > 0, "You have not pledged any funds to the campaign!");
        require(withdrawAmount > 0 && withdrawAmount <= pledgedAmount, "You have not pledged the specified amount!");

        campaign.pledgers[msg.sender] = pledgedAmount - withdrawAmount;

        if(campaign.pledgers[msg.sender] == 0){
            campaign.numberOfPledgers -= 1;
        }
        campaign.raisedAmount -= withdrawAmount;
        payable(msg.sender).transfer(withdrawAmount);

    }

    function collectPledges(uint256 _campaignId) public {
        Campaign storage campaign = campaigns[_campaignId];

        require(block.timestamp >= campaign.deadline, "Campaign has not reached deadline!");
        require(campaign.owner == msg.sender, "You are not the campaign creator!");
        // Maybe check if already collected fudns
        require(campaign.raisedAmount >= campaign.goalAmount, "Campaign has not reached its goal!");
        payable(msg.sender).transfer(campaign.raisedAmount);
    }

    function viewCampaign(uint256 _campaignId) public view returns(address, string memory, uint256, uint256, uint256, uint256) {
        Campaign storage campaign = campaigns[_campaignId];
        return (campaign.owner, campaign.title, campaign.goalAmount, campaign.deadline, campaign.raisedAmount, campaign.numberOfPledgers);
    }


}

// TODO: Add events