const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

/**
 * LiquidityRail invariant tests.
 *
 * These are the questions an auditor asks first:
 *   - Can the platform be made to pay principal?
 *   - Can fee withdrawal reach anything but accrued fees?
 *   - Can bet capital ever fund or subsidize a lending payout?
 *   - Can credibility be assigned rather than derived — or vandalized?
 *   - Can anyone open a loan against a builder who never consented?
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
  const ZERO = ethers.constants.AddressZero;

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
    await usdc
      .connect(signer)
      .approve(rail.address, ethers.constants.MaxUint256);
  }

  // A win is host-attested in the registry, then anchored on the rail.
  async function anchorWin(prize = S(5000), winner = builder) {
    await registry.declareWinner(1, winner.address, "Winner Project", prize);
    const declIndex = (await registry.getWinnerCount(1)).sub(1);
    await rail.anchorWin(1, declIndex);
    return declIndex.add(1); // winIds are dense from 1, anchored in order
  }

  // Full happy path: anchor → lender proposes → builder accepts.
  async function fundedLoan({
    principal = S(1000),
    collateral = S(1100),
    trancheSize = 0,
    provider = ZERO,
    feeBps = 500,
    durationDays = 30,
  } = {}) {
    const winId = await anchorWin();
    await fundAndApprove(lender, principal.mul(2));
    const tx = await rail
      .connect(lender)
      .proposeLoan(winId, principal, collateral, trancheSize, provider, feeBps, durationDays, 0);
    const receipt = await tx.wait();
    const ev = receipt.events.find((e) => e.event === "LoanProposed");
    const proposalId = ev.args.proposalId;
    if (trancheSize.gt ? trancheSize.gt(0) : trancheSize > 0) {
      await fundAndApprove(trancheProvider, trancheSize);
      await rail.connect(trancheProvider).commitTranche(proposalId);
    }
    if (collateral.gt ? collateral.gt(0) : collateral > 0) {
      await fundAndApprove(builder, collateral);
    }
    await rail.connect(builder).acceptLoan(proposalId);
    return { winId, proposalId };
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
      expect(
        await rail.hasRole(await rail.FEE_ROLE(), feeRecipient.address)
      ).to.equal(true);
    });

    it("starts with no reserves", async function () {
      expect(await rail.totalLoanPrincipal()).to.equal(0);
      expect(await rail.totalCollateral()).to.equal(0);
      expect(await rail.accruedFees()).to.equal(0);
      expect(await rail.totalBetOwed()).to.equal(0);
    });
  });

  describe("Win anchoring", function () {
    it("anchors a registry declaration — builder and prize come from the host", async function () {
      const winId = await anchorWin(S(5000));
      const win = await rail.wins(winId);
      expect(win.builder).to.equal(builder.address);
      expect(win.prizeAmount).to.equal(S(5000));
      expect(win.hackathonId).to.equal(1);
      const history = await rail.builderHistory(builder.address);
      expect(history.winsAnchored).to.equal(1);
    });

    it("refuses to anchor the same declaration twice — no double-borrowing one prize", async function () {
      await registry.declareWinner(1, builder.address, "Winner Project", S(5000));
      await rail.anchorWin(1, 0);
      await expect(rail.anchorWin(1, 0)).to.be.revertedWith(
        "Win already anchored"
      );
    });

    it("refuses a declaration index that does not exist", async function () {
      await expect(rail.anchorWin(1, 7)).to.be.revertedWith(
        "Declaration index out of range"
      );
    });

    it("refuses an unknown hackathon", async function () {
      await expect(rail.anchorWin(9, 0)).to.be.revertedWith("Unknown hackathon");
    });
  });

  describe("Invariant 1 — the platform never absorbs a credit loss", function () {
    it("overcollateralized: builder posts collateral, receives principal less the fee", async function () {
      const winId = await anchorWin();
      await fundAndApprove(lender, S(1000));
      await rail
        .connect(lender)
        .proposeLoan(winId, S(1000), S(1100), 0, ZERO, 500, 30, 0);
      await fundAndApprove(builder, S(1100));

      const lenderBefore = await usdc.balanceOf(lender.address);
      await rail.connect(builder).acceptLoan(1);

      expect(await usdc.balanceOf(builder.address)).to.equal(S(1100 - 1100).add(S(950)));
      // builder spent 1100 collateral, received 950 net principal
      expect((await usdc.balanceOf(lender.address)).sub(lenderBefore)).to.equal(
        S(-1000)
      );
      expect(await rail.accruedFees()).to.equal(S(50));
      expect(await rail.totalLoanPrincipal()).to.equal(S(1000));
      expect(await rail.totalCollateral()).to.equal(S(1100));
      // The contract holds collateral + fee; principal is not custodied.
      expect(await usdc.balanceOf(rail.address)).to.equal(S(1150));
    });

    it("overcollateralized: default liquidates collateral TO THE LENDER, surplus returns to builder", async function () {
      const { winId } = await fundedLoan({ collateral: S(1100), feeBps: 0, durationDays: 1 });

      const lenderBefore = await usdc.balanceOf(lender.address);
      const builderBefore = await usdc.balanceOf(builder.address);

      await ethers.provider.send("evm_increaseTime", [2 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.defaultLoan(winId);

      // Lender is made whole at par from the collateral; the surplus goes
      // back to the builder. Platform pays nothing.
      expect((await usdc.balanceOf(lender.address)).sub(lenderBefore)).to.equal(
        S(1000)
      );
      expect((await usdc.balanceOf(builder.address)).sub(builderBefore)).to.equal(
        S(100)
      );
      expect(await rail.totalLoanPrincipal()).to.equal(0);
      expect(await rail.totalCollateral()).to.equal(0);
      const history = await rail.builderHistory(builder.address);
      expect(history.loansDefaulted).to.equal(1);
    });

    it("tranche-backed: commit escrows first-loss, default pays the lender from it", async function () {
      const { winId } = await fundedLoan({
        collateral: ethers.constants.Zero,
        trancheSize: S(1000),
        provider: trancheProvider.address,
        feeBps: 0,
        durationDays: 1,
      });

      const lenderBefore = await usdc.balanceOf(lender.address);
      await ethers.provider.send("evm_increaseTime", [2 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.defaultLoan(winId);

      expect((await usdc.balanceOf(lender.address)).sub(lenderBefore)).to.equal(
        S(1000)
      );
      expect(await rail.totalTrancheAbsorbed()).to.equal(S(1000));
      expect(await rail.totalTrancheCapacity()).to.equal(0);
    });

    it("hybrid: collateral liquidates first, tranche covers the shortfall", async function () {
      const { winId } = await fundedLoan({
        collateral: S(600),
        trancheSize: S(700),
        provider: trancheProvider.address,
        feeBps: 0,
        durationDays: 1,
      });

      const lenderBefore = await usdc.balanceOf(lender.address);
      const providerBefore = await usdc.balanceOf(trancheProvider.address);

      await ethers.provider.send("evm_increaseTime", [2 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.defaultLoan(winId);

      // 600 collateral + 400 of the 700 tranche = principal; 300 refunded.
      expect((await usdc.balanceOf(lender.address)).sub(lenderBefore)).to.equal(
        S(1000)
      );
      expect(
        (await usdc.balanceOf(trancheProvider.address)).sub(providerBefore)
      ).to.equal(S(300));
      expect(await rail.totalTrancheAbsorbed()).to.equal(S(400));
    });

    it("refuses proposals that don't cover principal", async function () {
      const winId = await anchorWin();
      await expect(
        rail
          .connect(lender)
          .proposeLoan(winId, S(1000), S(999), 0, ZERO, 0, 30, 0)
      ).to.be.revertedWith("Coverage below principal");
    });

    it("refuses principal above the declared prize", async function () {
      const winId = await anchorWin(S(500));
      await expect(
        rail
          .connect(lender)
          .proposeLoan(winId, S(1000), S(1000), 0, ZERO, 0, 30, 0)
      ).to.be.revertedWith("Principal exceeds prize");
    });

    it("enforces launch bounds on size, fee, and duration", async function () {
      const winId = await anchorWin();
      await expect(
        rail.connect(lender).proposeLoan(winId, S(60000), S(60000), 0, ZERO, 0, 30, 0)
      ).to.be.revertedWith("Loan exceeds max size");
      await expect(
        rail.connect(lender).proposeLoan(winId, S(1000), S(1000), 0, ZERO, 5000, 30, 0)
      ).to.be.revertedWith("Fee exceeds ceiling");
      await expect(
        rail.connect(lender).proposeLoan(winId, S(1000), S(1000), 0, ZERO, 0, 365, 0)
      ).to.be.revertedWith("Bad duration");
    });
  });

  describe("Consent — nobody finances a builder who didn't agree", function () {
    it("refuses a builder self-funding — no laundering a tranche through yourself", async function () {
      const winId = await anchorWin();
      await expect(
        rail
          .connect(builder)
          .proposeLoan(winId, S(1000), 0, S(1000), trancheProvider.address, 0, 30, 0)
      ).to.be.revertedWith("Builder cannot self-fund");
    });

    it("refuses a lender naming themselves the tranche provider", async function () {
      const winId = await anchorWin();
      await expect(
        rail
          .connect(lender)
          .proposeLoan(winId, S(1000), 0, S(1000), lender.address, 0, 30, 0)
      ).to.be.revertedWith("Tranche must be third-party");
    });

    it("refuses the builder as tranche provider — self-funded protection proves nothing", async function () {
      const winId = await anchorWin();
      await expect(
        rail
          .connect(lender)
          .proposeLoan(winId, S(1000), 0, S(1000), builder.address, 0, 30, 0)
      ).to.be.revertedWith("Builder cannot back own loan");
    });

    it("refuses anyone but the builder to accept", async function () {
      const winId = await anchorWin();
      await fundAndApprove(lender, S(1000));
      await rail
        .connect(lender)
        .proposeLoan(winId, S(1000), S(1000), 0, ZERO, 0, 30, 0);
      await expect(
        rail.connect(lender).acceptLoan(1)
      ).to.be.revertedWith("Not the builder");
    });

    it("one loan per win, ever — a financed win can't be re-leveraged", async function () {
      const { winId } = await fundedLoan();
      await expect(
        rail
          .connect(lender)
          .proposeLoan(winId, S(100), S(100), 0, ZERO, 0, 30, 0)
      ).to.be.revertedWith("Win already financed");
    });

    it("a cancelled or uncommitted proposal cannot be accepted", async function () {
      const winId = await anchorWin();
      await fundAndApprove(lender, S(1000));
      await rail
        .connect(lender)
        .proposeLoan(winId, S(1000), 0, S(1000), trancheProvider.address, 0, 30, 0);
      await expect(rail.connect(builder).acceptLoan(1)).to.be.revertedWith(
        "Tranche not committed"
      );
      await rail.connect(lender).cancelProposal(1);
      await expect(rail.connect(builder).acceptLoan(1)).to.be.revertedWith(
        "Proposal not open"
      );
    });
  });

  describe("Tranche lifecycle", function () {
    it("provider can withdraw a committed tranche before acceptance", async function () {
      const winId = await anchorWin();
      await rail
        .connect(lender)
        .proposeLoan(winId, S(1000), 0, S(1000), trancheProvider.address, 0, 30, 0);
      await fundAndApprove(trancheProvider, S(1000));
      await rail.connect(trancheProvider).commitTranche(1);

      const before = await usdc.balanceOf(trancheProvider.address);
      await rail.connect(trancheProvider).withdrawTranche(1);
      expect(
        (await usdc.balanceOf(trancheProvider.address)).sub(before)
      ).to.equal(S(1000));
      expect(await rail.totalTrancheCapacity()).to.equal(0);
    });

    it("cancelling a proposal refunds a committed tranche to its provider", async function () {
      const winId = await anchorWin();
      await rail
        .connect(lender)
        .proposeLoan(winId, S(1000), 0, S(1000), trancheProvider.address, 0, 30, 0);
      await fundAndApprove(trancheProvider, S(1000));
      await rail.connect(trancheProvider).commitTranche(1);

      const before = await usdc.balanceOf(trancheProvider.address);
      await rail.connect(lender).cancelProposal(1);
      expect(
        (await usdc.balanceOf(trancheProvider.address)).sub(before)
      ).to.equal(S(1000));
    });
  });

  describe("Invariant 2 — revenue is fees on notional only, actually funded", function () {
    it("the fee is segregated into the contract at accept", async function () {
      await fundedLoan({ feeBps: 500 }); // 5% of 1000 = 50
      expect(await rail.accruedFees()).to.equal(S(50));
      // balance = collateral 1100 + fee 50; nothing else was pulled.
      expect(await usdc.balanceOf(rail.address)).to.equal(S(1150));
    });

    it("lets FEE_ROLE withdraw exactly the accrued fees", async function () {
      await fundedLoan({ feeBps: 500 });
      await expect(rail.connect(feeRecipient).withdrawFees(feeRecipient.address, S(50)))
        .to.emit(rail, "FeesWithdrawn")
        .withArgs(feeRecipient.address, S(50));
      expect(await rail.accruedFees()).to.equal(0);
    });

    it("refuses to withdraw more than accrued — escrowed capital is unreachable", async function () {
      await fundedLoan({ feeBps: 500 });
      await expect(
        rail.connect(feeRecipient).withdrawFees(feeRecipient.address, S(51))
      ).to.be.revertedWith("Insufficient accrued fees");
    });

    it("refuses fee withdrawal from a non-fee role", async function () {
      await fundedLoan({ feeBps: 500 });
      await expect(
        rail.connect(lender).withdrawFees(lender.address, S(1))
      ).to.be.revertedWith(/AccessControl/);
    });

    it("keeps accrued fees even after a default", async function () {
      const { winId } = await fundedLoan({ feeBps: 500, durationDays: 1 });
      await ethers.provider.send("evm_increaseTime", [2 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.defaultLoan(winId);
      expect(await rail.accruedFees()).to.equal(S(50));
    });
  });

  describe("Repayment", function () {
    it("repays the lender at par, returns collateral to builder, releases tranche", async function () {
      const { winId } = await fundedLoan({ feeBps: 0 });
      await usdc.mint(builder.address, S(5000)); // the prize lands
      await usdc.connect(builder).approve(rail.address, ethers.constants.MaxUint256);

      const lenderBefore = await usdc.balanceOf(lender.address);
      const builderBefore = await usdc.balanceOf(builder.address);

      await rail.connect(builder).repayLoan(winId);

      expect((await usdc.balanceOf(lender.address)).sub(lenderBefore)).to.equal(
        S(1000)
      );
      // collateral returned, principal paid out
      expect((await usdc.balanceOf(builder.address)).sub(builderBefore)).to.equal(
        S(100)
      );
      expect((await rail.loans(winId)).status).to.equal(2); // REPAID
      expect(await rail.totalCollateral()).to.equal(0);
      const history = await rail.builderHistory(builder.address);
      expect(history.loansRepaid).to.equal(1);
    });

    it("anyone can repay on the builder's behalf", async function () {
      const { winId } = await fundedLoan({ feeBps: 0 });
      await fundAndApprove(trancheProvider, S(1000));
      const lenderBefore = await usdc.balanceOf(lender.address);
      await rail.connect(trancheProvider).repayLoan(winId);
      expect((await usdc.balanceOf(lender.address)).sub(lenderBefore)).to.equal(
        S(1000)
      );
    });

    it("refuses to repay twice", async function () {
      const { winId } = await fundedLoan({ feeBps: 0 });
      await fundAndApprove(builder, S(1000));
      await rail.connect(builder).repayLoan(winId);
      await expect(rail.connect(builder).repayLoan(winId)).to.be.revertedWith(
        "Loan not open"
      );
    });
  });

  describe("Market — resolves on the organizer's payout, not the loan", function () {
    it("resolves PAID from the registry even with no loan at all", async function () {
      // The liveness fix: a win with zero loans still resolves.
      const winId = await anchorWin();
      await fundAndApprove(bettorYes, S(100));
      await fundAndApprove(bettorNo, S(300));
      await rail.connect(bettorYes).placeBet(winId, S(100), true);
      await rail.connect(bettorNo).placeBet(winId, S(300), false);

      await registry.recordPayout(1, 0, "0xpayouthash");
      await rail.resolveMarket(winId);

      const m = await rail.markets(winId);
      expect(m.outcome).to.equal(1); // PAID

      const yesBefore = await usdc.balanceOf(bettorYes.address);
      await rail.connect(bettorYes).claimWinnings(winId);
      // lone winner takes the whole 400 pool
      expect((await usdc.balanceOf(bettorYes.address)).sub(yesBefore)).to.equal(
        S(400)
      );
      expect(await rail.totalBetOwed()).to.equal(0);
    });

    it("resolves UNPAID after the window with no payout", async function () {
      const winId = await anchorWin();
      await fundAndApprove(bettorNo, S(50));
      await rail.connect(bettorNo).placeBet(winId, S(50), false);

      await ethers.provider.send("evm_increaseTime", [91 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.resolveMarket(winId);

      const m = await rail.markets(winId);
      expect(m.outcome).to.equal(2); // UNPAID
      const history = await rail.builderHistory(builder.address);
      expect(history.winsUnpaid).to.equal(1);
    });

    it("a defaulted loan does NOT resolve the market UNPAID if the organizer paid", async function () {
      const { winId } = await fundedLoan({ feeBps: 0, durationDays: 1 });
      await fundAndApprove(bettorYes, S(100));
      await rail.connect(bettorYes).placeBet(winId, S(100), true);

      // Organizer pays; the default path then closes for everyone — dueAt
      // alone says nothing about whether the prize landed.
      await registry.recordPayout(1, 0, "0xpayouthash");
      await ethers.provider.send("evm_increaseTime", [2 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await expect(rail.defaultLoan(winId)).to.be.revertedWith(
        "Payout already recorded"
      );
      await rail.resolveMarket(winId);

      const m = await rail.markets(winId);
      expect(m.outcome).to.equal(1); // PAID — the organizer paid.
    });

    it("refuses resolution before payout or deadline", async function () {
      const winId = await anchorWin();
      await expect(rail.resolveMarket(winId)).to.be.revertedWith(
        "Win unresolved"
      );
    });

    it("pays winning bettors pro-rata and closes totalBetOwed to dust", async function () {
      const winId = await anchorWin();
      await fundAndApprove(bettorYes, S(200));
      await fundAndApprove(bettorNo, S(300));
      await rail.connect(bettorYes).placeBet(winId, S(100), true);
      await rail.connect(bettorYes).placeBet(winId, S(100), true); // second stake, same side
      await rail.connect(bettorNo).placeBet(winId, S(300), false);

      await registry.recordPayout(1, 0, "0xpayouthash");
      await rail.resolveMarket(winId);

      const yesBefore = await usdc.balanceOf(bettorYes.address);
      await rail.connect(bettorYes).claimWinnings(winId);
      expect((await usdc.balanceOf(bettorYes.address)).sub(yesBefore)).to.equal(
        S(500)
      );
      await expect(
        rail.connect(bettorNo).claimWinnings(winId)
      ).to.be.revertedWith("Nothing to claim");
      expect(await rail.totalBetOwed()).to.equal(0);
    });

    it("refuses bets after payout is recorded or the window closes", async function () {
      const winId = await anchorWin();
      await registry.recordPayout(1, 0, "0xpayouthash");
      await fundAndApprove(bettorYes, S(100));
      await expect(
        rail.connect(bettorYes).placeBet(winId, S(100), true)
      ).to.be.revertedWith("Payout already recorded");
    });

    it("refuses a builder betting on their own win", async function () {
      const winId = await anchorWin();
      await fundAndApprove(builder, S(100));
      await expect(
        rail.connect(builder).placeBet(winId, S(100), true)
      ).to.be.revertedWith("Builder cannot bet on own win");
    });
  });

  describe("Invariant 4 — credibility is derived, never assigned or vandalized", function () {
    it("has no setter for reputation", async function () {
      const names = rail.interface.fragments
        .filter((f) => f.type === "function")
        .map((f) => f.name.toLowerCase());
      const setters = names.filter((n) =>
        /set.*(reputation|credibility|score)/.test(n)
      );
      expect(setters).to.deep.equal([]);
    });

    it("records payout stats at market resolution, not loan settlement", async function () {
      const winId = await anchorWin();
      await ethers.provider.send("evm_increaseTime", [3 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await registry.recordPayout(1, 0, "0xpayouthash");
      await rail.resolveMarket(winId);

      const history = await rail.builderHistory(builder.address);
      expect(history.winsAnchored).to.equal(1);
      expect(history.winsPaid).to.equal(1);
      expect(await rail.payoutRateBps(builder.address)).to.equal(10000);
      expect(await rail.averageDaysToPay(builder.address)).to.be.gte(3);
    });

    it("a stranger cannot ding a builder's record — only the builder consents to a loan", async function () {
      const winId = await anchorWin();
      // A lender can propose whatever they like; without the builder's accept,
      // no loan exists and no history is written.
      await fundAndApprove(lender, S(10));
      await rail
        .connect(lender)
        .proposeLoan(winId, S(10), S(10), 0, ZERO, 0, 1, 0);
      const history = await rail.builderHistory(builder.address);
      expect(history.loansTaken).to.equal(0);
      expect(history.loansDefaulted).to.equal(0);
    });
  });

  describe("Pause and admin", function () {
    it("pause stops new risk, never exits", async function () {
      const { winId, proposalId } = await fundedLoan({ feeBps: 0 });
      // a second proposal still open for cancel testing
      const win2 = await anchorWin();
      await rail.connect(lender).proposeLoan(win2, S(10), S(10), 0, ZERO, 0, 30, 0);

      await rail.pause();

      // entries blocked
      await expect(rail.anchorWin(1, 9)).to.be.reverted;
      await expect(
        rail.connect(lender).proposeLoan(win2, S(10), S(10), 0, ZERO, 0, 30, 0)
      ).to.be.reverted;
      await expect(
        rail.connect(bettorYes).placeBet(winId, S(1), true)
      ).to.be.reverted;

      // exits still work while paused
      await fundAndApprove(builder, S(1000));
      await rail.connect(builder).repayLoan(winId);
      await rail.connect(lender).cancelProposal(2);

      await rail.unpause();
      expect(await rail.paused()).to.equal(false);
    });

    it("refuses non-admin pause", async function () {
      await expect(rail.connect(lender).pause()).to.be.revertedWith(
        /AccessControl/
      );
    });

    it("moves the fee role on recipient change", async function () {
      await rail.updateFeeRecipient(bettorYes.address);
      expect(await rail.feeRecipient()).to.equal(bettorYes.address);
      expect(
        await rail.hasRole(await rail.FEE_ROLE(), bettorYes.address)
      ).to.equal(true);
    });

    it("updates the resolution window", async function () {
      await rail.setResolutionWindow(30 * DAY);
      expect(await rail.marketResolutionWindow()).to.equal(30 * DAY);
    });

    it("freezes the deadline at anchor — a window change cannot rewrite a live market", async function () {
      const winId = await anchorWin();
      const win = await rail.wins(winId);

      // Admin shrinks the window to 1 day; the anchored win keeps its
      // original 90-day deadline — bettors priced against it.
      await rail.setResolutionWindow(DAY);
      await ethers.provider.send("evm_increaseTime", [2 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await expect(rail.resolveMarket(winId)).to.be.revertedWith(
        "Win unresolved"
      );
      expect((await rail.wins(winId)).resolutionDeadline).to.equal(
        win.resolutionDeadline
      );
    });

    it("blocks a registry swap while market stakes are unresolved", async function () {
      const winId = await anchorWin();
      await fundAndApprove(bettorYes, S(50));
      await rail.connect(bettorYes).placeBet(winId, S(50), true);

      await expect(
        rail.updateRegistry(bettorYes.address)
      ).to.be.revertedWith("Unresolved markets");

      // Resolve, then the swap is free.
      await ethers.provider.send("evm_increaseTime", [91 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await rail.resolveMarket(winId);
      await rail.updateRegistry(registry.address);
    });

    it("blocks a token swap while obligations are live", async function () {
      const { winId } = await fundedLoan({ feeBps: 500 });
      await expect(
        rail.updateUsdcToken(bettorYes.address)
      ).to.be.revertedWith("Live obligations");
      await fundAndApprove(builder, S(1000));
      await rail.connect(builder).repayLoan(winId);
      // Fees are still accrued — the book is not clean until withdrawn.
      await expect(
        rail.updateUsdcToken(bettorYes.address)
      ).to.be.revertedWith("Live obligations");
    });
  });
});
