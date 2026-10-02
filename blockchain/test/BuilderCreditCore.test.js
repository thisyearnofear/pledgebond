const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("BuilderCreditCore", function () {
  let HackathonRegistry;
  let BuilderCreditCore;
  let MockUSDC;
  let hackathonRegistry;
  let builderCreditCore;
  let mockUSDC;
  
  let owner;
  let treasury;
  let hackathonHost;
  let developer1;
  let developer2;
  let verifier1;
  let verifier2;
  let verifier3;
  let nonVerifier;

  const hackathonName = "Test Hackathon";
  const requiredSignatures = 2;
  let hackathonId;
  let startDate;
  let endDate;

  let projectId;
  const projectName = "Test Project";
  const githubUrl = "https://github.com/test/project";
  const milestoneDescriptions = [
    "Complete the UI design",
    "Implement core functionality",
    "Deploy to testnet"
  ];
  const milestoneAmounts = [
    ethers.utils.parseUnits("100", 6),
    ethers.utils.parseUnits("200", 6),
    ethers.utils.parseUnits("300", 6)
  ];
  const totalAmount = ethers.utils.parseUnits("600", 6);
  const initialFunding = ethers.utils.parseUnits("10000", 6);

  beforeEach(async function () {
    [owner, treasury, hackathonHost, developer1, developer2, verifier1, verifier2, verifier3, nonVerifier] = await ethers.getSigners();
    
    const currentTime = Math.floor(Date.now() / 1000);
    startDate = currentTime;
    endDate = currentTime + (30 * 24 * 60 * 60);
    
    // Deploy HackathonRegistry
    const HackathonRegistryFactory = await ethers.getContractFactory("HackathonRegistry");
    hackathonRegistry = await HackathonRegistryFactory.deploy();
    await hackathonRegistry.deployed();
    
    // Deploy Mock USDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.deployed();
    
    // Deploy BuilderCreditCore via UUPS proxy
    const BuilderCreditCoreFactory = await ethers.getContractFactory("BuilderCreditCore");
    builderCreditCore = await upgrades.deployProxy(
      BuilderCreditCoreFactory,
      [hackathonRegistry.address, mockUSDC.address, owner.address],
      { kind: "uups", initializer: "initialize" }
    );
    await builderCreditCore.deployed();
    
    // Setup hackathon
    const initialVerifiers = [verifier1.address, verifier2.address, verifier3.address];
    await hackathonRegistry.createHackathon(
      hackathonName,
      hackathonHost.address,
      initialVerifiers,
      requiredSignatures,
      startDate,
      endDate
    );
    hackathonId = 1;
    
    // Mint USDC to BuilderCreditCore proxy
    await mockUSDC.mint(builderCreditCore.address, initialFunding);
    
    // Grant roles
    await builderCreditCore.grantRole(await builderCreditCore.TREASURY_ROLE(), treasury.address);
    await builderCreditCore.grantRole(await builderCreditCore.SCORER_ROLE(), owner.address);
  });

  describe("Deployment", function () {
    it("Should set the correct registry and token addresses", async function () {
      expect(await builderCreditCore.registry()).to.equal(hackathonRegistry.address);
      expect(await builderCreditCore.usdcToken()).to.equal(mockUSDC.address);
    });
    
    it("Should set the correct roles", async function () {
      expect(await builderCreditCore.hasRole(await builderCreditCore.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await builderCreditCore.hasRole(await builderCreditCore.PLATFORM_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await builderCreditCore.hasRole(await builderCreditCore.TREASURY_ROLE(), treasury.address)).to.equal(true);
    });
    
    it("Should be upgradeable by admin", async function () {
      // Deploy a new implementation
      const BuilderCreditCoreFactory = await ethers.getContractFactory("BuilderCreditCore");
      const upgraded = await upgrades.upgradeProxy(builderCreditCore.address, BuilderCreditCoreFactory, {
        kind: "uups",
      });
      expect(upgraded.address).to.equal(builderCreditCore.address);
    });
  });

  describe("Project Funding", function () {
    it("Should allow a developer to request funding", async function () {
      const verifiedScore = 600; 
      await builderCreditCore.connect(owner).setReputation(developer1.address, verifiedScore);
      
      await expect(
        builderCreditCore.connect(developer1).requestFunding(
          [hackathonId],
          githubUrl,
          projectName,
          milestoneDescriptions,
          milestoneAmounts
        )
      ).to.emit(builderCreditCore, "ProjectCreated");
      
      projectId = 1;
      
      const project = await builderCreditCore.projects(projectId);
      expect(project.developer).to.equal(developer1.address);
      expect(project.name).to.equal(projectName);
      expect(project.fundingAmount).to.equal(totalAmount);
      expect(project.isActive).to.equal(true);
    });

    it("Should fail if total amount exceeds credit limit", async function () {
      const verifiedScore = 400; // Max funding is 500 USDC
      await builderCreditCore.connect(owner).setReputation(developer1.address, verifiedScore);
      
      const largeAmount = ethers.utils.parseUnits("1000", 6); 
      
      await expect(builderCreditCore.connect(developer1).requestFunding(
        [hackathonId],
        githubUrl,
        projectName,
        ["One big milestone"],
        [largeAmount]
      )).to.be.revertedWith("Requested amount exceeds credit limit");
    });
  });

  describe("Milestone Approvals", function () {
    beforeEach(async function () {
      const verifiedScore = 600;
      await builderCreditCore.connect(owner).setReputation(developer1.address, verifiedScore);
      await builderCreditCore.connect(developer1).requestFunding(
        [hackathonId],
        githubUrl,
        projectName,
        milestoneDescriptions,
        milestoneAmounts
      );
      projectId = 1;
    });

    it("Should complete milestone when threshold is reached", async function () {
      const milestoneId = 0;
      const initialDevBalance = await mockUSDC.balanceOf(developer1.address);
      
      await builderCreditCore.connect(verifier1).approveMilestone(projectId, milestoneId);
      
      await expect(builderCreditCore.connect(verifier2).approveMilestone(projectId, milestoneId))
        .to.emit(builderCreditCore, "MilestoneCompleted")
        .withArgs(projectId, milestoneId, milestoneAmounts[milestoneId], developer1.address);
        
      const finalDevBalance = await mockUSDC.balanceOf(developer1.address);
      expect(finalDevBalance.sub(initialDevBalance)).to.equal(milestoneAmounts[milestoneId]);
    });
  });

  describe("Loan Repayment", function () {
    const loanAmount = ethers.utils.parseUnits("500", 6);

    beforeEach(async function () {
      const verifiedScore = 400;
      await builderCreditCore.connect(owner).setReputation(developer1.address, verifiedScore);
      
      await builderCreditCore.connect(developer1).requestFunding(
        [hackathonId],
        githubUrl,
        projectName,
        ["Initial funding"],
        [loanAmount]
      );
      
      await mockUSDC.mint(developer1.address, loanAmount);
      await mockUSDC.connect(developer1).approve(builderCreditCore.address, loanAmount);
    });

    it("Should allow developer to repay loan and increase reputation", async function () {
      const repayAmount = ethers.utils.parseUnits("200", 6);
      const initialReputation = (await builderCreditCore.creditLines(developer1.address)).reputation;

      await expect(builderCreditCore.connect(developer1).repayLoan(repayAmount))
        .to.emit(builderCreditCore, "LoanRepaid")
        .withArgs(developer1.address, repayAmount);

      const creditLine = await builderCreditCore.creditLines(developer1.address);
      expect(creditLine.usedAmount).to.equal(loanAmount.sub(repayAmount));
      expect(creditLine.reputation).to.equal(initialReputation.add(2));
    });

    it("Should fail if repayment exceeds used amount", async function () {
      const tooMuch = loanAmount.add(1);
      await expect(builderCreditCore.connect(developer1).repayLoan(tooMuch))
        .to.be.revertedWith("Repayment exceeds used amount");
    });
  });

  describe("Hackathon Validation", function () {
    it("Should reject funding requests listing a nonexistent hackathon", async function () {
      await builderCreditCore.connect(owner).setReputation(developer1.address, 600);

      await expect(
        builderCreditCore.connect(developer1).requestFunding(
          [hackathonId, 9999],
          githubUrl,
          projectName,
          milestoneDescriptions,
          milestoneAmounts
        )
      ).to.be.revertedWith("Hackathon does not exist");
    });
  });

  describe("Per-Hackathon Milestone Thresholds", function () {
    let hackathonIdB;

    beforeEach(async function () {
      // Second hackathon: 2-of-2 with a disjoint verifier set
      await hackathonRegistry.createHackathon(
        "Hackathon B",
        hackathonHost.address,
        [developer2.address, nonVerifier.address],
        2,
        startDate,
        endDate
      );
      hackathonIdB = 2;

      await builderCreditCore.connect(owner).setReputation(developer1.address, 600);
      await builderCreditCore.connect(developer1).requestFunding(
        [hackathonId, hackathonIdB],
        githubUrl,
        projectName,
        milestoneDescriptions,
        milestoneAmounts
      );
      projectId = 1;
    });

    it("Should not count approvals from different hackathons toward the same threshold", async function () {
      // verifier1 (hackathon A) + developer2 (hackathon B) = 1 approval each
      await builderCreditCore.connect(verifier1).approveMilestone(projectId, 0);
      await builderCreditCore.connect(developer2).approveMilestone(projectId, 0);

      const milestones = await builderCreditCore.getProjectMilestones(projectId);
      expect(milestones[0].completed).to.equal(false);
    });

    it("Should complete when one hackathon reaches its own threshold", async function () {
      await builderCreditCore.connect(verifier1).approveMilestone(projectId, 0);
      await expect(
        builderCreditCore.connect(verifier2).approveMilestone(projectId, 0)
      ).to.emit(builderCreditCore, "MilestoneCompleted");
    });
  });

  describe("Team Validation", function () {
    it("Should reject zero-address team members (Arc reverts on zero transfers)", async function () {
      await builderCreditCore.connect(owner).setReputation(developer1.address, 600);

      await expect(
        builderCreditCore.connect(developer1).requestFundingWithTeam(
          [hackathonId],
          githubUrl,
          projectName,
          ["Milestone"],
          [ethers.utils.parseUnits("100", 6)],
          [developer1.address, ethers.constants.AddressZero],
          [5000, 5000]
        )
      ).to.be.revertedWith("Invalid team member");
    });
  });

  describe("Aggregate Credit Cap", function () {
    it("Should reject a second request that exceeds the credit line", async function () {
      await builderCreditCore.connect(owner).setReputation(developer1.address, 400);

      // Score 400 => credit line is 500 USDC (baseCreditAmount)
      const amount = ethers.utils.parseUnits("500", 6);
      await builderCreditCore.connect(developer1).requestFunding(
        [hackathonId],
        githubUrl,
        projectName,
        ["First"],
        [amount]
      );

      // Second request passes the per-request check (500 <= 500) but the
      // aggregate usedAmount would exceed the credit line
      await expect(
        builderCreditCore.connect(developer1).requestFunding(
          [hackathonId],
          githubUrl,
          "Second Project",
          ["Second"],
          [amount]
        )
      ).to.be.revertedWith("Exceeds credit line");
    });
  });

  describe("Prize Pool (pull-based payouts)", function () {
    const backAmount = ethers.utils.parseUnits("100", 6);

    beforeEach(async function () {
      await builderCreditCore.connect(owner).setReputation(developer1.address, 600);
      await builderCreditCore.connect(developer1).requestFunding(
        [hackathonId],
        githubUrl,
        projectName,
        milestoneDescriptions,
        milestoneAmounts
      );
      projectId = 1;

      // developer2 backs at 150%, nonVerifier backs at 100%
      await mockUSDC.mint(developer2.address, backAmount);
      await mockUSDC.mint(nonVerifier.address, backAmount);
      await mockUSDC.connect(developer2).approve(builderCreditCore.address, backAmount);
      await mockUSDC.connect(nonVerifier).approve(builderCreditCore.address, backAmount);
      await builderCreditCore.connect(developer2).backProject(projectId, 150, backAmount);
      await builderCreditCore.connect(nonVerifier).backProject(projectId, 100, backAmount);
      // owed: 150 + 100 = 250
    });

    it("Should let backers claim their payouts from a funded pool", async function () {
      const prize = ethers.utils.parseUnits("500", 6);
      await mockUSDC.mint(treasury.address, prize);
      await mockUSDC.connect(treasury).approve(builderCreditCore.address, prize);

      await expect(builderCreditCore.connect(treasury).fundPrize(projectId, prize))
        .to.emit(builderCreditCore, "PrizeFunded")
        .withArgs(projectId, prize, prize);

      const owed = ethers.utils.parseUnits("150", 6);
      await expect(builderCreditCore.connect(developer2).claimPayout(projectId))
        .to.emit(builderCreditCore, "BackerPayoutClaimed")
        .withArgs(projectId, developer2.address, owed, owed);

      // Builder claims the remainder: 500 - 250 = 250
      const remainder = ethers.utils.parseUnits("250", 6);
      await expect(builderCreditCore.connect(developer1).claimBuilderPayout(projectId))
        .to.emit(builderCreditCore, "BuilderPayoutClaimed")
        .withArgs(projectId, developer1.address, remainder);
    });

    it("Should pay pro-rata shares when the pool is underfunded", async function () {
      const prize = ethers.utils.parseUnits("125", 6); // half of 250 owed
      await mockUSDC.mint(treasury.address, prize);
      await mockUSDC.connect(treasury).approve(builderCreditCore.address, prize);
      await builderCreditCore.connect(treasury).fundPrize(projectId, prize);

      // developer2 owed 150/250 => 75; nonVerifier owed 100/250 => 50
      await expect(builderCreditCore.connect(developer2).claimPayout(projectId))
        .to.emit(builderCreditCore, "BackerPayoutClaimed")
        .withArgs(
          projectId,
          developer2.address,
          ethers.utils.parseUnits("75", 6),
          ethers.utils.parseUnits("150", 6)
        );

      await expect(builderCreditCore.connect(nonVerifier).claimPayout(projectId))
        .to.emit(builderCreditCore, "BackerPayoutClaimed")
        .withArgs(
          projectId,
          nonVerifier.address,
          ethers.utils.parseUnits("50", 6),
          ethers.utils.parseUnits("100", 6)
        );
    });

    it("Should not let milestones drain a funded prize pool", async function () {
      // Treasury withdraws the unreserved balance first, then funds a prize.
      // The milestone cannot touch the reserved pool.
      const contractBalance = await mockUSDC.balanceOf(builderCreditCore.address);
      await builderCreditCore.connect(treasury).withdrawFunds(
        mockUSDC.address,
        contractBalance
      );

      const prize = ethers.utils.parseUnits("500", 6);
      await mockUSDC.mint(treasury.address, prize);
      await mockUSDC.connect(treasury).approve(builderCreditCore.address, prize);
      await builderCreditCore.connect(treasury).fundPrize(projectId, prize);

      await builderCreditCore.connect(verifier1).approveMilestone(projectId, 0);
      await expect(
        builderCreditCore.connect(verifier2).approveMilestone(projectId, 0)
      ).to.be.revertedWith("Insufficient unreserved balance");
    });

    it("Should protect prize pools from treasury withdrawals", async function () {
      const prize = ethers.utils.parseUnits("500", 6);
      await mockUSDC.mint(treasury.address, prize);
      await mockUSDC.connect(treasury).approve(builderCreditCore.address, prize);
      await builderCreditCore.connect(treasury).fundPrize(projectId, prize);

      // Balance is now 10700 (10200 prior + 500 prize). Unreserved = 10200.
      const contractBalance = await mockUSDC.balanceOf(builderCreditCore.address);
      const unreserved = contractBalance.sub(prize);

      // One wei more than unreserved dips into the pool
      await expect(
        builderCreditCore.connect(treasury).withdrawFunds(
          mockUSDC.address,
          unreserved.add(1)
        )
      ).to.be.revertedWith("Cannot withdraw prize pools");

      // Withdrawing exactly the unreserved portion is allowed
      await expect(
        builderCreditCore.connect(treasury).withdrawFunds(
          mockUSDC.address,
          unreserved
        )
      ).to.emit(builderCreditCore, "FundsWithdrawn");
    });
  });

  describe("Backing Limits & Refunds", function () {
    beforeEach(async function () {
      await builderCreditCore.connect(owner).setReputation(developer1.address, 600);
      await builderCreditCore.connect(developer1).requestFunding(
        [hackathonId],
        githubUrl,
        projectName,
        milestoneDescriptions,
        milestoneAmounts
      );
      projectId = 1;
    });

    it("Should enforce the per-transaction backing cap", async function () {
      const tooMuch = ethers.utils.parseUnits("1500", 6);
      await mockUSDC.mint(developer2.address, tooMuch);
      await mockUSDC.connect(developer2).approve(builderCreditCore.address, tooMuch);

      await expect(
        builderCreditCore.connect(developer2).backProject(projectId, 100, tooMuch)
      ).to.be.revertedWith("Amount exceeds per-transaction limit");
    });

    it("Should refund backing after the delay if no milestone completed", async function () {
      const backAmount = ethers.utils.parseUnits("100", 6);
      await mockUSDC.mint(developer2.address, backAmount);
      await mockUSDC.connect(developer2).approve(builderCreditCore.address, backAmount);
      await builderCreditCore.connect(developer2).backProject(projectId, 100, backAmount);

      // Too early
      await expect(
        builderCreditCore.connect(developer2).refundBacking(projectId)
      ).to.be.revertedWith("Refund delay not elapsed");

      // Advance 31 days
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(builderCreditCore.connect(developer2).refundBacking(projectId))
        .to.emit(builderCreditCore, "BackingRefunded")
        .withArgs(projectId, developer2.address, backAmount);

      // Claimed flag set: cannot refund or claim again
      await expect(
        builderCreditCore.connect(developer2).refundBacking(projectId)
      ).to.be.revertedWith("Nothing to refund");
    });

    it("Should not refund once a milestone has deployed capital", async function () {
      const backAmount = ethers.utils.parseUnits("100", 6);
      await mockUSDC.mint(developer2.address, backAmount);
      await mockUSDC.connect(developer2).approve(builderCreditCore.address, backAmount);
      await builderCreditCore.connect(developer2).backProject(projectId, 100, backAmount);

      await builderCreditCore.connect(verifier1).approveMilestone(projectId, 0);
      await builderCreditCore.connect(verifier2).approveMilestone(projectId, 0);

      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        builderCreditCore.connect(developer2).refundBacking(projectId)
      ).to.be.revertedWith("Backing already deployed");
    });
  });

  describe("Check-in Rate Limiting", function () {
    beforeEach(async function () {
      await builderCreditCore.connect(owner).setReputation(developer1.address, 600);
      await builderCreditCore.connect(developer1).requestFunding(
        [hackathonId],
        githubUrl,
        projectName,
        milestoneDescriptions,
        milestoneAmounts
      );
      projectId = 1;
    });

    it("Should rate-limit check-ins and cap reputation farming", async function () {
      const repBefore = (await builderCreditCore.creditLines(developer1.address)).reputation;

      await expect(
        builderCreditCore.connect(developer1).postCheckIn(projectId, "progress")
      ).to.emit(builderCreditCore, "CheckInPosted");

      const repAfter = (await builderCreditCore.creditLines(developer1.address)).reputation;
      expect(repAfter).to.equal(repBefore.add(1));

      await expect(
        builderCreditCore.connect(developer1).postCheckIn(projectId, "again")
      ).to.be.revertedWith("Check-in interval not elapsed");

      // After a day, check-in is allowed again
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        builderCreditCore.connect(developer1).postCheckIn(projectId, "day two")
      ).to.emit(builderCreditCore, "CheckInPosted");
    });
  });
});
