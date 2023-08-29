const { expect } = require('chai');
const {
  loadFixture,
} = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { ethers } = require('hardhat');

describe('Deployment', function () {
  async function deployContractFixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();
    const contract = await ethers.deployContract('Crowdfunding');

    return {
      contract,
      owner,
      addr1,
      addr2,
      addr3,
    };
  }

  async function createCampaignFixture() {
    const { contract, owner, addr1, addr2, addr3 } = await loadFixture(
      deployContractFixture
    );

    const arguments = [
      addr1.address, // _owner
      'Campaign 1', // _title
      ethers.parseEther('1'), // _goalAmount
      BigInt(Math.floor(Date.now() / 1000) + 3600), // _deadline
    ];

    const campaign = await contract.createCampaign(...arguments);

    return { campaign, arguments, contract, addr1, addr2, addr3 };
  }

  it('Basic owner check', async function () {
    const { contract, owner } = await loadFixture(deployContractFixture);
    expect(await contract.contractOwner()).to.equal(owner.address);
  });

  describe('Create campaign and view it', function () {
    it('Create campaign', async function () {
      const { campaign, arguments, contract } = await loadFixture(
        createCampaignFixture
      );

      await expect(campaign)
        .to.emit(contract, 'CampaignCreated')
        .withArgs(0, ...arguments);
    });

    it('View campaign', async function () {
      const { _, arguments, contract } = await loadFixture(
        createCampaignFixture
      );

      expect(await contract.viewCampaign(0)).to.deep.equal([
        ...arguments,
        '0',
        '0',
      ]);
    });
  });

  describe('Successful campaign', function () {
    it('Pledge full amount to campaign and collect pledges when over', async function () {
      const { campaign, arguments, contract, addr1, addr2 } = await loadFixture(
        createCampaignFixture
      );

      await expect(
        contract.connect(addr2).pledge(0, { value: ethers.parseEther('1') })
      )
        .to.emit(contract, 'Pledged')
        .withArgs(addr2.address, 0, ethers.parseEther('1'));

      // move timestamp to after deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      while ((await ethers.provider.getBlock('latest')).timestamp < deadline) {
        await ethers.provider.send('evm_mine', []);
      }

      await expect(contract.connect(addr1).collectPledges(0))
        .to.emit(contract, 'CollectedPledges')
        .withArgs(addr1.address, 0, ethers.parseEther('1'));
    });
  });

  describe('Unsuccessful campaign', function () {
    it('Pledge less than full amount and withdraw when campaign ends', async function () {
      const { campaign, arguments, contract, addr1, addr2 } = await loadFixture(
        createCampaignFixture
      );

      await expect(
        contract.connect(addr2).pledge(0, { value: ethers.parseEther('.5') })
      )
        .to.emit(contract, 'Pledged')
        .withArgs(addr2.address, 0, ethers.parseEther('.5'));

      // move timestamp to after deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      while ((await ethers.provider.getBlock('latest')).timestamp < deadline) {
        await ethers.provider.send('evm_mine', []);
      }

      await expect(contract.connect(addr2).withdrawPledge(0))
        .to.emit(contract, 'PledgeWithdrawn')
        .withArgs(addr2.address, 0, ethers.parseEther('.5'));
    });
  });

  describe('Try to create campaign with wrong parameters', function () {
    it('Campaign with goal of 0 eth', async function () {
      const { contract, owner } = await loadFixture(deployContractFixture);

      const arguments = [
        owner.address, // _owner
        'Campaign 2', // _title
        ethers.parseEther('0'), // _goalAmount
        BigInt(Math.floor(Date.now() / 1000) + 3600), // _deadline
      ];

      await expect(contract.createCampaign(...arguments)).to.be.revertedWith(
        'Campaign goal has to be >0'
      );
    });

    it('Campaign with a wrong with a deadline that has passed', async function () {
      const { contract, owner } = await loadFixture(deployContractFixture);

      const arguments = [
        owner.address, // _owner
        'Campaign 3', // _title
        ethers.parseEther('12'), // _goalAmount
        BigInt(Math.floor(Date.now() / 1000) - 3600), // _deadline
      ];

      await expect(contract.createCampaign(...arguments)).to.be.revertedWith(
        'Incorrect deadline!'
      );
    });
  });

  describe('Incorrect pledges', function () {
    it('Pledge 0 eth', async function () {
      const { campaign, arguments, contract, addr1 } = await loadFixture(
        createCampaignFixture
      );

      await expect(
        contract.connect(addr1).pledge(0, { value: ethers.parseEther('0') })
      ).to.be.revertedWith('Pledge has to be >0');
    });

    it('Pledge to campaign that has reached deadline', async function () {
      const { campaign, arguments, contract, addr1 } = await loadFixture(
        createCampaignFixture
      );

      // move timestamp to after deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      while ((await ethers.provider.getBlock('latest')).timestamp < deadline) {
        await ethers.provider.send('evm_mine', []);
      }

      await expect(
        contract.connect(addr1).pledge(0, { value: ethers.parseEther('10') })
      ).to.be.revertedWith('Campaign has reached deadline!');
    });
  });

  describe('Incorrect pledge widthdrawal', function () {
    it("Withdraw from campaign where signer didn't pledge", async function () {
      const { campaign, arguments, contract, addr1 } = await loadFixture(
        createCampaignFixture
      );

      await expect(
        contract.connect(addr1).withdrawPledge(0)
      ).to.be.revertedWith('You have not pledged any funds to the campaign!');
    });

    it('Withdraw more than signer pledged', async function () {
      const { campaign, arguments, contract, addr1 } = await loadFixture(
        createCampaignFixture
      );

      await contract
        .connect(addr1)
        .pledge(0, { value: ethers.parseEther('1') });

      await expect(
        contract
          .connect(addr1)
          ['withdrawPledge(uint256, uint256)'](0, ethers.parseEther('10'))
      ).to.be.revertedWith('You have not pledged the specified amount!');
    });
  });

  describe('Incorrect collect pledges', function () {
    it('Collect pledges from campaign that has not reached deadline', async function () {
      const { campaign, arguments, contract, addr1, addr2 } = await loadFixture(
        createCampaignFixture
      );

      await contract
        .connect(addr2)
        .pledge(0, { value: ethers.parseEther('1') });

      await expect(
        contract.connect(addr1).collectPledges(0)
      ).to.be.revertedWith('Campaign has not reached deadline!');
    });

    it('Collect pledges with wrong signer', async function () {
      const { campaign, arguments, contract, addr1, addr2 } = await loadFixture(
        createCampaignFixture
      );

      await contract
        .connect(addr2)
        .pledge(0, { value: ethers.parseEther('1') });

      // move timestamp to after deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      while ((await ethers.provider.getBlock('latest')).timestamp < deadline) {
        await ethers.provider.send('evm_mine', []);
      }

      await expect(
        contract.connect(addr2).collectPledges(0)
      ).to.be.revertedWith('You are not the campaign creator!');
    });

    it('Collect pledges from campaign that has not reached goal', async function () {
      const { campaign, arguments, contract, addr1, addr2 } = await loadFixture(
        createCampaignFixture
      );

      await contract
        .connect(addr2)
        .pledge(0, { value: ethers.parseEther('0.5') });

      // move timestamp to after deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      while ((await ethers.provider.getBlock('latest')).timestamp < deadline) {
        await ethers.provider.send('evm_mine', []);
      }

      await expect(
        contract.connect(addr1).collectPledges(0)
      ).to.be.revertedWith('Campaign has not reached its goal!');
    });
  });

  describe('Test canRefund modifier', function () {
    it('Try to refund after deadline with goal reached', async function () {
      const { campaign, arguments, contract, addr1, addr2 } = await loadFixture(
        createCampaignFixture
      );

      await contract
        .connect(addr2)
        .pledge(0, { value: ethers.parseEther('5') });

      // move timestamp to after deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      while ((await ethers.provider.getBlock('latest')).timestamp < deadline) {
        await ethers.provider.send('evm_mine', []);
      }

      await expect(
        contract.connect(addr2).withdrawPledge(0)
      ).to.be.revertedWith('Cannot refund now');
    });

    it('Refund before deadline', async function () {
      const { campaign, arguments, contract, addr1, addr2 } = await loadFixture(
        createCampaignFixture
      );

      await contract
        .connect(addr2)
        .pledge(0, { value: ethers.parseEther('5') });

      await expect(contract.connect(addr2).withdrawPledge(0))
        .to.emit(contract, 'PledgeWithdrawn')
        .withArgs(addr2.address, 0, ethers.parseEther('5'));
    });

    it('Refund after deadline with goal not reached', async function () {
      const { campaign, arguments, contract, addr1, addr2 } = await loadFixture(
        createCampaignFixture
      );

      await contract
        .connect(addr2)
        .pledge(0, { value: ethers.parseEther('0.5') });

      // move timestamp to after deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      while ((await ethers.provider.getBlock('latest')).timestamp < deadline) {
        await ethers.provider.send('evm_mine', []);
      }

      await expect(contract.connect(addr2).withdrawPledge(0))
        .to.emit(contract, 'PledgeWithdrawn')
        .withArgs(addr2.address, 0, ethers.parseEther('0.5'));
    });
  });
});
