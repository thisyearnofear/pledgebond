const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

/**
 * LiquidityRail invariant tests.
 *
 * These are the questions an auditor asks first:
 *   - Can the platform be made to pay principal?
 *   - Can fee withdrawal reach anything but accrued fees?
 *   - Can bet capital ever fund or subsidize a lending payout?
 *   - Can credibility be assigned rather than derived?
 */
describe("LiquidityRail", function () {
  let rail;
  let registry;
  let usdc;

  let admin;
  let feeRecipient;
  let builder;
  let lender;
  let bettorYes;
  let bettorNo;
  let trancheProvider;

  const S = (n) => ethers.utils.parseUnits(String(n), 6);
  const DAY = 24 * 60 * 60;

  async function nextWinId() {
    for (let i = 1; i < 100; i++) {
      const w = await rail.wins(i);
      if (w.builder !== ethers.constants.AddressZero) return i;
    }
    throw new Error("no win found");
  }

  beforeEach(async function () {
    [admin, feeRecipient, builder, lender, bettorYes, bettorNo, trancheProvider] =
      await ethers.getSigners();

    const R = await ethers.getContractFactory("HackathonRegistry");
    registry = await R.deploy();
    await registry.deployed();

    const U = await ethers.getContractFactory("MockUSDC");
    usdc = await U.deploy();
    await usdc.deployed();

    const L = await ethers.getContractFactory("LiquidityRail");
    rail = await upgrades.deployProxy(L, [
      registry.address,
      usdc.address,
      admin.address,
      feeRecipient.address,
    ]);
    await rail.deployed();

    const now = Math.floor(Date.now() / 1000);
    await registry.createHackathon(
      "Test Hackathon",
      admin.address,
      [admin.address],
      1,
      now,
      now + 365 * DAY
    );
  });

  async function fundAndApprove(signer, amount) {
    await usdc.mint(signer.address, amount);
    // openLoan pulls principal + collateral, and a bettor may place several
    // bets, so approve generously rather than guessing exact per-call amounts.
    await usdc
      .connect(signer)
      .approve(rail.address, ethers.constants.MaxUint256);
  }

  async function declareWin(prize = S(5000)) {
    await rail.declareWin(1, builder.address, "Winner Project", prize);
    // The builder repays from the prize, so they must approve the rail.
    await usdc.connect(builder).approve(rail.address, ethers.constants.MaxUint256);
    return nextWinId();
  }

  describe("Initialization", function () {
    it("wires registry, token, and fee recipient", async function () {
      expect(await rail.registry()).to.equal(registry.address);
      expect(await rail.usdcToken()).to.equal(usdc.address);
      expect(await rail.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("grants admin and fee roles", async function () {
      expect(
        await rail.hasRole(await rail.DEFAULT_ADMIN_ROLE(), admin.address)
      ).to.equal(true);
      expect(await rail.hasRole(await rail.FEE_ROLE(), feeRecipient.address)).to.equal(
        true
      );
    });

    it("starts with no reserves", async function () {
      expect(await rail.totalLoanPrincipal()).to.equal(0);
      expect(await rail.totalCollateral()).to.equal(0);
      expect(await rail.accruedFees()).to.equal(0);
      expect(await rail.totalBetOwed()).to.equal(0);
    });
  });

  describe("Invariant 1 — the platform never absorbs a credit loss", function () {
    it("overcollateralized: lender funds, builder receives less the fee", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));

      await rail
        .connect(lender)
        .openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 500, 30, 0);

      expect(await usdc.balanceOf(builder.address)).to.equal(S(950));
      expect(await rail.accruedFees()).to.equal(S(50));
      expect(await rail.totalLoanPrincipal()).to.equal(S(1000));
    });

    it("overcollateralized: default returns collateral, platform pays nothing", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 0, 1, 0);

      const adminBefore = await usdc.balanceOf(feeRecipient.address);

      await ethers.provider.send("evm_increaseTime", [2 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.defaultLoan(winId);

      // Collateral went back to the builder, not to the lender or platform.
      expect(await rail.totalLoanPrincipal()).to.equal(0);
      expect(await rail.totalCollateral()).to.equal(0);
      expect(await usdc.balanceOf(feeRecipient.address)).to.equal(adminBefore);
    });

    it("tranche-backed: requires tranche to cover principal", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(1000));

      await expect(
        rail.connect(lender).openLoan(winId, S(1000), 0, S(500), ethers.constants.AddressZero, 0, 30, 0)
      ).to.be.revertedWith("Tranche must cover principal");
    });

    it("tranche-backed: default consumes tranche, not platform funds", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(1000));
      await fundAndApprove(trancheProvider, S(1000));
      await rail.connect(lender).openLoan(
        winId, S(1000), 0, S(1000), trancheProvider.address, 0, 1, 0
      );

      const feeBefore = await usdc.balanceOf(feeRecipient.address);
      const contractBefore = await usdc.balanceOf(rail.address);

      await ethers.provider.send("evm_increaseTime", [2 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.defaultLoan(winId);

      // The tranche sat in the contract and was consumed by the loss.
      expect(await usdc.balanceOf(rail.address)).to.equal(
        contractBefore.sub(S(1000))
      );
      expect(await usdc.balanceOf(feeRecipient.address)).to.equal(feeBefore);
      expect(await rail.totalTrancheAbsorbed()).to.equal(S(1000));
    });

    it("refuses a loan on a settled or unknown win", async function () {
      await expect(
        rail.connect(lender).openLoan(999, S(100), S(100), 0, ethers.constants.AddressZero, 0, 30, 0)
      ).to.be.revertedWith("Win not open for lending");
    });

    it("refuses collateral below principal", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(1000));
      await expect(
        rail.connect(lender).openLoan(winId, S(1000), S(999), 0, ethers.constants.AddressZero, 0, 30, 0)
      ).to.be.revertedWith("Collateral must cover principal");
    });

    it("enforces launch bounds on size, rate, and duration", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(100000));

      await expect(
        rail.connect(lender).openLoan(winId, S(60000), S(60000), 0, ethers.constants.AddressZero, 0, 30, 0)
      ).to.be.revertedWith("Loan exceeds max size");

      await expect(
        rail.connect(lender).openLoan(winId, S(1000), S(1000), 0, ethers.constants.AddressZero, 5000, 30, 0)
      ).to.be.revertedWith("Rate exceeds ceiling");

      await expect(
        rail.connect(lender).openLoan(winId, S(1000), S(1000), 0, ethers.constants.AddressZero, 0, 365, 0)
      ).to.be.revertedWith("Bad duration");
    });
  });

  describe("Invariant 2 — revenue is fees on notional only", function () {
    it("accrues the origination fee and nothing else", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 800, 30, 0);

      expect(await rail.accruedFees()).to.equal(S(80));
    });

    it("lets FEE_ROLE withdraw exactly the accrued fees", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 500, 30, 0);

      await expect(
        rail.connect(feeRecipient).withdrawFees(admin.address, S(50))
      )
        .to.emit(rail, "FeesWithdrawn")
        .withArgs(admin.address, S(50));

      expect(await rail.accruedFees()).to.equal(0);
    });

    it("refuses to withdraw more than accrued — cannot reach principal", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 500, 30, 0);

      // Contract holds only collateral + fee; only the fee is ours.
      await expect(
        rail.connect(feeRecipient).withdrawFees(admin.address, S(1150))
      ).to.be.revertedWith("Insufficient accrued fees");
    });

    it("refuses fee withdrawal from a non-fee role", async function () {
      await expect(
        rail.connect(admin).withdrawFees(admin.address, S(1))
      ).to.be.revertedWith(/AccessControl/);
    });

    it("keeps accrued fees even after a default", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 500, 1, 0);

      await ethers.provider.send("evm_increaseTime", [2 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.defaultLoan(winId);

      // Fee was earned, not borrowed — it survives the default.
      expect(await rail.accruedFees()).to.equal(S(50));
    });
  });

  describe("Settlement", function () {
    async function settledLoan() {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 500, 30, 0);
      // The organizer pays out; the registry records it.
      // The organizer pays the prize to the builder; repayment comes from it.
      await usdc.mint(builder.address, S(5000));
      await registry.declareWinner(1, builder.address, "Winner Project", S(5000));
      await registry.recordPayout(1, builder.address, "0xpayouthash");
      return winId;
    }

    it("refuses to settle without a recorded payout", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 500, 30, 0);

      await expect(rail.settleLoan(winId)).to.be.revertedWith(
        "Payout not recorded"
      );
    });

    it("refuses to settle on an unrelated winner's payout", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 500, 30, 0);

      // Someone ELSE's win gets paid at the same hackathon.
      await registry.declareWinner(1, lender.address, "Other Winner", S(1000));
      await registry.recordPayout(1, lender.address, "0xotherhash");

      await expect(rail.settleLoan(winId)).to.be.revertedWith(
        "Payout not recorded"
      );
    });

    it("repays the lender at par and releases collateral", async function () {
      const winId = await settledLoan();

      const lenderBefore = await usdc.balanceOf(lender.address);
      await rail.settleLoan(winId);

      expect((await usdc.balanceOf(lender.address)).sub(lenderBefore)).to.equal(
        S(1000)
      );
      expect((await rail.loans(winId)).status).to.equal(2); // REPAID
      expect(await rail.totalLoanPrincipal()).to.equal(0);
      expect(await rail.totalCollateral()).to.equal(0);
    });

    it("refuses to settle twice", async function () {
      const winId = await settledLoan();
      await rail.settleLoan(winId);
      await expect(rail.settleLoan(winId)).to.be.revertedWith("Loan not open");
    });
  });

  describe("Invariant 4 — credibility is derived, never assigned", function () {
    it("has no setter for reputation", async function () {
      const names = rail.interface.fragments
        .filter((f) => f.type === "function")
        .map((f) => f.name.toLowerCase());
      const setters = names.filter((n) =>
        /set.*(reputation|credibility|score)/.test(n)
      );
      expect(setters).to.deep.equal([]);
    });

    it("records coverage and speed on settlement", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 500, 30, 0);
      // The organizer pays the prize to the builder; repayment comes from it.
      await usdc.mint(builder.address, S(5000));
      await registry.declareWinner(1, builder.address, "Winner Project", S(5000));
      await registry.recordPayout(1, builder.address, "0xpayouthash");

      await ethers.provider.send("evm_increaseTime", [3 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.settleLoan(winId);

      const history = await rail.builderHistory(builder.address);
      expect(history.winsDeclared).to.equal(1);
      expect(history.winsSettledInFull).to.equal(1);
      expect(history.loansRepaid).to.equal(1);
      expect(await rail.coverageRateBps(builder.address)).to.equal(10000);
      expect(await rail.averageDaysToPay(builder.address)).to.be.gte(3);
    });

    it("records a default as a coverage failure", async function () {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 0, 1, 0);

      await ethers.provider.send("evm_increaseTime", [2 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.defaultLoan(winId);

      const history = await rail.builderHistory(builder.address);
      expect(history.winsDefaulted).to.equal(1);
      expect(await rail.coverageRateBps(builder.address)).to.equal(0);
    });
  });

  describe("Invariant 3 — lenders and bettors never mix", function () {
    async function openLoanForBetting() {
      const winId = await declareWin();
      await fundAndApprove(lender, S(2200));
      await rail.connect(lender).openLoan(winId, S(1000), S(1100), 0, ethers.constants.AddressZero, 0, 30, 0);
      return winId;
    }

    it("escrows bets and tracks them separately from principal", async function () {
      const winId = await openLoanForBetting();
      await fundAndApprove(bettorYes, S(100));
      await rail.connect(bettorYes).placeBet(winId, S(100), true);

      expect(await rail.totalBetStakes()).to.equal(S(100));
      expect(await rail.totalLoanPrincipal()).to.equal(S(1000));
    });

    it("refuses a builder betting on their own win", async function () {
      const winId = await openLoanForBetting();
      await fundAndApprove(builder, S(100));
      await expect(
        rail.connect(builder).placeBet(winId, S(100), true)
      ).to.be.revertedWith("Builder cannot bet on own win");
    });

    it("pays winning bettors pro-rata from the bet pool only", async function () {
      const winId = await openLoanForBetting();
      await fundAndApprove(bettorYes, S(100));
      await fundAndApprove(bettorNo, S(300));
      await rail.connect(bettorYes).placeBet(winId, S(100), true);
      await rail.connect(bettorNo).placeBet(winId, S(300), false);

      // Win settles: the builder was paid.
      // The organizer pays the prize to the builder; repayment comes from it.
      await usdc.mint(builder.address, S(5000));
      await registry.declareWinner(1, builder.address, "Winner Project", S(5000));
      await registry.recordPayout(1, builder.address, "0xpayouthash");
      await rail.settleLoan(winId);
      await rail.settleBet(winId);

      const yesBefore = await usdc.balanceOf(bettorYes.address);
      const noBefore = await usdc.balanceOf(bettorNo.address);

      await rail.connect(bettorYes).claimBet(winId);
      await rail.connect(bettorNo).claimBet(winId);

      // The single "yes" bettor took the whole 400 pool.
      expect((await usdc.balanceOf(bettorYes.address)).sub(yesBefore)).to.equal(
        S(400)
      );
      expect((await usdc.balanceOf(bettorNo.address)).sub(noBefore)).to.equal(0);
    });

    it("leaves lending capital untouched when a market resolves", async function () {
      const winId = await openLoanForBetting();
      await fundAndApprove(bettorYes, S(100));
      await rail.connect(bettorYes).placeBet(winId, S(100), true);

      const lenderBefore = await usdc.balanceOf(lender.address);
      // The organizer pays the prize to the builder; repayment comes from it.
      await usdc.mint(builder.address, S(5000));
      await registry.declareWinner(1, builder.address, "Winner Project", S(5000));
      await registry.recordPayout(1, builder.address, "0xpayouthash");
      await rail.settleLoan(winId);

      // Settlement paid the lender from their own funded principal only.
      expect((await usdc.balanceOf(lender.address)).sub(lenderBefore)).to.equal(
        S(1000)
      );
      expect(await rail.totalBetStakes()).to.equal(S(100));
    });

    it("refuses to resolve a market before the win resolves", async function () {
      const winId = await openLoanForBetting();
      await expect(rail.settleBet(winId)).to.be.revertedWith(
        "Win unresolved"
      );
    });
  });

  describe("Pause and admin", function () {
    it("lets admin pause and unpause", async function () {
      await rail.pause();
      expect(await rail.paused()).to.equal(true);
      await expect(
        rail.declareWin(1, builder.address, "X", S(1))
      ).to.be.reverted;
      await rail.unpause();
      expect(await rail.paused()).to.equal(false);
    });

    it("refuses non-admin pause", async function () {
      await expect(rail.connect(lender).pause()).to.be.revertedWith(
        /AccessControl/
      );
    });

    it("moves the fee role on recipient change", async function () {
      const newRecipient = bettorYes.address;
      await rail.updateFeeRecipient(newRecipient);
      expect(await rail.feeRecipient()).to.equal(newRecipient);
      expect(await rail.hasRole(await rail.FEE_ROLE(), newRecipient)).to.equal(
        true
      );
    });
  });
});