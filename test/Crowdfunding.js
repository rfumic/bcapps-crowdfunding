const { expect } = require('chai');

describe('Crowdfunding platform contract, basic owner check', function () {
  it('Deployment', async function () {
    const [owner] = await ethers.getSigners();

    const contract = await ethers.deployContract('Crowdfunding');

    expect(await contract.contractOwner()).to.equal(await owner.getAddress());
  });
});
