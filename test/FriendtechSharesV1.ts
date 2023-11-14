import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { FriendtechSharesV1, TestERC20 } from "../typechain-types"
import { expect } from "chai";

async function deployFriendTechFixture() {
    const [owner, alice, bob, person] = await ethers.getSigners()
    const testERC20 = await ethers.deployContract("TestERC20")
    const testERC20Address = await testERC20.getAddress()
    const FriendTech = await ethers.getContractFactory("FriendtechSharesV1")
    const friendTech = await FriendTech.deploy(testERC20Address)
    return { owner, alice, bob, person, friendTech, testERC20, testERC20Address }
}

describe("FriendtechShares", function () {
    let owner: HardhatEthersSigner, alice: HardhatEthersSigner, bob: HardhatEthersSigner, person: HardhatEthersSigner, friendTech: FriendtechSharesV1, testERC20: TestERC20, testERC20Address: string;

    beforeEach(async () => {
        ({ owner, alice, bob, person, friendTech, testERC20, testERC20Address } = await loadFixture(deployFriendTechFixture))
    })

    describe("Deployment", function () {
        it("should set the right fund token", async () => {
            expect(await friendTech.fundToken()).to.be.equal(testERC20Address)
        })
    })

    describe("Setters", function () {
        describe("setFeeDestination", function () {
            it("should not allow anyone to set Fee Destination", async () => {
                await expect(friendTech.connect(alice).setFeeDestination(owner.address)).to.be.be.revertedWith("Ownable: caller is not the owner");
            })
            it("should allow owner to set Fee Destination", async () => {
                await expect(friendTech.setFeeDestination(owner.address)).to.be.not.reverted;
                expect(await friendTech.protocolFeeDestination()).to.be.equal(owner.address)
            })
        })
        describe("setFeeBDestination", function () {
            it("should not allow anyone to set Fee B Destination", async () => {
                await expect(friendTech.connect(alice).setFeeBDestination(owner.address)).to.be.be.revertedWith("Ownable: caller is not the owner");
            })
            it("should allow owner to set Fee B Destination", async () => {
                await expect(friendTech.setFeeBDestination(owner.address)).to.be.not.reverted;
                expect(await friendTech.protocolBFeeDestination()).to.be.equal(owner.address)
            })
        })
        describe("setProtocolFeePercent", function () {
            it("should not allow anyone to set Protocol Fee Percentage", async () => {
                await expect(friendTech.connect(alice).setProtocolFeePercent(10)).to.be.be.revertedWith("Ownable: caller is not the owner");
            })
            it("should allow owner to set Protocol Fee Percentage", async () => {
                const percentage = BigInt(10) * BigInt(1e18)
                await expect(friendTech.setProtocolFeePercent(percentage)).to.be.not.reverted;
                expect(await friendTech.protocolFeePercent()).to.be.equal(percentage)
            })
        })
        describe("setProtocolBFeePercent", function () {
            it("should not allow anyone to set Protocol B Fee Percentage", async () => {
                await expect(friendTech.connect(alice).setProtocolBFeePercent(10)).to.be.be.revertedWith("Ownable: caller is not the owner");
            })
            it("should allow owner to set Protocol B Fee Percentage", async () => {
                const percentage = BigInt(10) * BigInt(1e18)
                await expect(friendTech.setProtocolBFeePercent(percentage)).to.be.not.reverted;
                expect(await friendTech.protocolBFeePercent()).to.be.equal(percentage)
            })
        })
        describe("setSubjectFeePercent", function () {
            it("should not allow anyone to set Subject Percentage", async () => {
                await expect(friendTech.connect(alice).setSubjectFeePercent(10)).to.be.be.revertedWith("Ownable: caller is not the owner");
            })
            it("should allow owner to set Subject Percentage", async () => {
                const percentage = BigInt(10) * BigInt(1e18)
                await expect(friendTech.setSubjectFeePercent(percentage)).to.be.not.reverted;
                expect(await friendTech.subjectFeePercent()).to.be.equal(percentage)
            })
        })
    })

    describe("buyShares", function () {
        beforeEach(async () => {
            await friendTech.setFeeDestination(alice.address)
            await friendTech.setFeeBDestination(bob.address)
        })
        it("should fail if buy more than 1 token in first buy", async () => {
            await expect(friendTech.buyShares(owner.address, 2)).to.be.revertedWithPanic(0x11);
        })
        it("should allow to buy 1st token with 0 fee", async () => {
            await expect(friendTech.buyShares(owner.address, 1)).to.be.not.reverted;
        })
        it("should fail if token allowance not provided", async () => {
            // first buy no revert because the fee was 0.
            await expect(friendTech.buyShares(owner.address, 1)).to.be.not.reverted;

            // second buy fee required. will revert becasue of the insufficient allowance.
            await expect(friendTech.buyShares(owner.address, 1)).to.be.rejectedWith("ERC20: insufficient allowance");
        })

        it("should allow to buy if proper allowance is provided", async () => {
            await expect(friendTech.connect(person).buyShares(person.address, 1)).to.be.not.reverted;

            const buyPrice = await friendTech.getBuyPrice(person.address, 1)
            const partyAShare = (buyPrice * BigInt(4)) / BigInt(100)
            const partyBShare = (buyPrice * BigInt(4)) / BigInt(100)
            const partyCShare = (buyPrice * BigInt(2)) / BigInt(100)

            const buyPriceWithFee = await friendTech.getBuyPriceAfterFee(person.address, 1)

            expect(buyPriceWithFee).to.be.equals(buyPrice + partyAShare + partyBShare + partyCShare)

            const friendTechAddress = await friendTech.getAddress()

            await testERC20.approve(friendTechAddress, buyPriceWithFee)

            const tx = await friendTech.buyShares(person.address, 1)
            await expect(tx).to.be.not.reverted;
            await expect(tx).to.emit(friendTech, "Trade").withArgs(owner.address, person.address, true, 1, buyPrice, partyAShare, partyBShare, partyCShare, 2)
            await expect(tx).to.changeTokenBalances(testERC20, [owner, alice, bob, person, friendTech], [`-${buyPriceWithFee}`, partyAShare, partyBShare, partyCShare, buyPrice])
        })
    })

    describe("sellShares", function () {
        beforeEach(async () => {
            await friendTech.setFeeDestination(alice.address)
            await friendTech.setFeeBDestination(bob.address)

            await friendTech.connect(person).buyShares(person.address, 1)

            const friendTechAddress = await friendTech.getAddress()

            await testERC20.approve(friendTechAddress, BigInt(100000) * BigInt(1e18))

            await friendTech.buyShares(person.address, 10)

            await testERC20.mint(person.address, BigInt(100000) * BigInt(1e18))

            await testERC20.connect(person).approve(friendTechAddress, BigInt(100000) * BigInt(1e18))

            await friendTech.connect(person).buyShares(person.address, 10)


        })
        it("should not allow to sell more than you own", async () => {
            await expect(friendTech.sellShares(person.address, 11)).to.be.revertedWith("Insufficient shares")
        })
        it("should not allow to sell the last share", async () => {
            await friendTech.sellShares(person.address, 10)
            await expect(friendTech.connect(person).sellShares(person.address, 11)).to.be.revertedWith("Cannot sell the last share")
        })
        it("should allow you to sell", async () => {
            const sellPrice = await friendTech.getSellPrice(person.address, 10)
            const partyAShare = (sellPrice * BigInt(4)) / BigInt(100)
            const partyBShare = (sellPrice * BigInt(4)) / BigInt(100)
            const partyCShare = (sellPrice * BigInt(2)) / BigInt(100)

            const sellPriceAfterFee = await friendTech.getSellPriceAfterFee(person.address, 10)

            expect(sellPriceAfterFee).to.be.equals(sellPrice - partyAShare - partyBShare - partyCShare)

            const tx = await friendTech.sellShares(person.address, 10)
            await expect(tx).to.be.not.reverted;
            await expect(tx).to.emit(friendTech, "Trade").withArgs(owner.address, person.address, false, 10, sellPrice, partyAShare, partyBShare, partyCShare, 11)
            await expect(tx).to.changeTokenBalances(testERC20, [owner, alice, bob, person, friendTech], [sellPriceAfterFee, partyAShare, partyBShare, partyCShare, `-${sellPrice}`])
        })
    })
})