const { expect } = require('chai');
const {
  loadFixture,
} = require('@nomicfoundation/hardhat-toolbox/network-helpers');

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
      BigInt(Math.floor(Date.now() / 1000) + 604800), // _deadline
      // (Math.floor(Date.now() / 1000) + 604800).toString(), // _deadline
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
    it('Pledge to campaign', async function () {
      const { campaign, arguments, contract, addr1, addr2 } = await loadFixture(
        createCampaignFixture
      );

      await expect(
        contract.connect(addr2).pledge(0, { value: ethers.parseEther('1') })
      )
        .to.emit(contract, 'Pledged')
        .withArgs(addr2.address, 0, ethers.parseEther('1'));
    });
  });
});
