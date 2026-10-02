const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HackathonRegistry", function () {
  let HackathonRegistry;
  let hackathonRegistry;
  let owner;
  let host;
  let verifier1;
  let verifier2;
  let verifier3;
  let nonVerifier;

  // Test variables
  const hackathonName = "Test Hackathon";
  const requiredSignatures = 2;
  let startDate;
  let endDate;

  beforeEach(async function () {
    // Get signers
    [owner, host, verifier1, verifier2, verifier3, nonVerifier] = await ethers.getSigners();
    
    // Set dates
    const currentTime = Math.floor(Date.now() / 1000);
    startDate = currentTime;
    endDate = currentTime + (30 * 24 * 60 * 60); // 30 days later
    
    // Deploy contract
    HackathonRegistry = await ethers.getContractFactory("HackathonRegistry");
    hackathonRegistry = await HackathonRegistry.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await hackathonRegistry.hasRole(await hackathonRegistry.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await hackathonRegistry.hasRole(await hackathonRegistry.PLATFORM_ADMIN_ROLE(), owner.address)).to.equal(true);
    });
  });

  describe("Hackathon Creation", function () {
    it("Should create a hackathon with correct parameters", async function () {
      const initialVerifiers = [verifier1.address, verifier2.address, verifier3.address];
      
      await hackathonRegistry.createHackathon(
        hackathonName,
        host.address,
        initialVerifiers,
        requiredSignatures,
        startDate,
        endDate
      );
      
      // Check if hackathon exists
      const hackathonId = await hackathonRegistry.hackathonsByName(hackathonName);
      expect(hackathonId).to.equal(1);
      
      // Check hackathon details
      const details = await hackathonRegistry.getHackathonDetails(hackathonId);
      expect(details.name).to.equal(hackathonName);
      expect(details.organizer).to.equal(host.address);
      expect(details.startDate).to.equal(startDate);
      expect(details.endDate).to.equal(endDate);
      expect(details.isActive).to.equal(true);
      
      // Check verifiers
      const verifiers = await hackathonRegistry.getHackathonVerifiers(hackathonId);
      expect(verifiers.length).to.equal(3);
      expect(verifiers).to.include.members(initialVerifiers);
      
      // Check required signatures
      expect(await hackathonRegistry.getRequiredSignatures(hackathonId)).to.equal(requiredSignatures);
    });

    it("Should revert if name is empty", async function () {
      const initialVerifiers = [verifier1.address];
      
      await expect(
        hackathonRegistry.createHackathon(
          "",
          host.address,
          initialVerifiers,
          1,
          startDate,
          endDate
        )
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Should revert if not enough verifiers", async function () {
      const initialVerifiers = [verifier1.address];
      
      await expect(
        hackathonRegistry.createHackathon(
          hackathonName,
          host.address,
          initialVerifiers,
          2, // Requires 2 verifiers but only 1 provided
          startDate,
          endDate
        )
      ).to.be.revertedWith("Not enough initial verifiers");
    });
    
    it("Should revert if start date is after end date", async function () {
      const initialVerifiers = [verifier1.address, verifier2.address];
      
      await expect(
        hackathonRegistry.createHackathon(
          hackathonName,
          host.address,
          initialVerifiers,
          1,
          endDate, // Swapped
          startDate // Swapped
        )
      ).to.be.revertedWith("Start date must be before end date");
    });
  });

  describe("Verifier Management", function () {
    let hackathonId;
    
    beforeEach(async function () {
      // Create a hackathon first
      const initialVerifiers = [verifier1.address, verifier2.address];
      
      await hackathonRegistry.createHackathon(
        hackathonName,
        host.address,
        initialVerifiers,
        requiredSignatures,
        startDate,
        endDate
      );
      
      hackathonId = await hackathonRegistry.hackathonsByName(hackathonName);
    });
    
    it("Should allow host to add a verifier", async function () {
      await hackathonRegistry.connect(host).addVerifier(hackathonId, verifier3.address);
      
      // Check if verifier was added
      expect(await hackathonRegistry.isVerifier(hackathonId, verifier3.address)).to.equal(true);
      
      const verifiers = await hackathonRegistry.getHackathonVerifiers(hackathonId);
      expect(verifiers.length).to.equal(3);
      expect(verifiers).to.include(verifier3.address);
    });
    
    it("Should allow platform admin to add a verifier", async function () {
      await hackathonRegistry.connect(owner).addVerifier(hackathonId, verifier3.address);
      
      // Check if verifier was added
      expect(await hackathonRegistry.isVerifier(hackathonId, verifier3.address)).to.equal(true);
    });
    
    it("Should not allow unauthorized users to add a verifier", async function () {
      await expect(
        hackathonRegistry.connect(nonVerifier).addVerifier(hackathonId, verifier3.address)
      ).to.be.revertedWith("Not authorized");
    });
    
    it("Should allow host to remove a verifier", async function () {
      // Add a third verifier first
      await hackathonRegistry.connect(host).addVerifier(hackathonId, verifier3.address);
      
      // Remove one verifier
      await hackathonRegistry.connect(host).removeVerifier(hackathonId, verifier1.address);
      
      // Check if verifier was removed
      expect(await hackathonRegistry.isVerifier(hackathonId, verifier1.address)).to.equal(false);
      
      const verifiers = await hackathonRegistry.getHackathonVerifiers(hackathonId);
      expect(verifiers.length).to.equal(2);
      expect(verifiers).to.not.include(verifier1.address);
    });
    
    it("Should revert if removing verifier would break threshold", async function () {
      // Try to remove a verifier when we have 2 verifiers and need 2 signatures
      await expect(
        hackathonRegistry.connect(host).removeVerifier(hackathonId, verifier1.address)
      ).to.be.revertedWith("Would reduce verifiers below threshold");
    });
  });

  describe("Signature Requirements", function () {
    let hackathonId;
    
    beforeEach(async function () {
      // Create a hackathon first
      const initialVerifiers = [verifier1.address, verifier2.address, verifier3.address];
      
      await hackathonRegistry.createHackathon(
        hackathonName,
        host.address,
        initialVerifiers,
        1, // Start with 1 required signature
        startDate,
        endDate
      );
      
      hackathonId = await hackathonRegistry.hackathonsByName(hackathonName);
    });
    
    it("Should allow host to update required signatures", async function () {
      await hackathonRegistry.connect(host).setRequiredSignatures(hackathonId, 2);
      
      // Check if required signatures were updated
      expect(await hackathonRegistry.getRequiredSignatures(hackathonId)).to.equal(2);
    });
    
    it("Should revert if required signatures exceed verifier count", async function () {
      await expect(
        hackathonRegistry.connect(host).setRequiredSignatures(hackathonId, 4)
      ).to.be.revertedWith("Not enough verifiers for requirement");
    });
  });

  describe("Hackathon Status", function () {
    let hackathonId;
    
    beforeEach(async function () {
      // Create a hackathon first
      const initialVerifiers = [verifier1.address, verifier2.address];
      
      await hackathonRegistry.createHackathon(
        hackathonName,
        host.address,
        initialVerifiers,
        1,
        startDate,
        endDate
      );
      
      hackathonId = await hackathonRegistry.hackathonsByName(hackathonName);
    });
    
    it("Should allow host to deactivate a hackathon", async function () {
      await hackathonRegistry.connect(host).setHackathonStatus(hackathonId, false);
      
      // Check if hackathon was deactivated
      const details = await hackathonRegistry.getHackathonDetails(hackathonId);
      expect(details.isActive).to.equal(false);
      
      // Verifier check should return false for inactive hackathons
      expect(await hackathonRegistry.isVerifier(hackathonId, verifier1.address)).to.equal(false);
    });
    
    it("Should allow host to reactivate a hackathon", async function () {
      // Deactivate first
      await hackathonRegistry.connect(host).setHackathonStatus(hackathonId, false);
      
      // Reactivate
      await hackathonRegistry.connect(host).setHackathonStatus(hackathonId, true);
      
      // Check if hackathon was reactivated
      const details = await hackathonRegistry.getHackathonDetails(hackathonId);
      expect(details.isActive).to.equal(true);
      
      // Verifier check should work again
      expect(await hackathonRegistry.isVerifier(hackathonId, verifier1.address)).to.equal(true);
    });
  });

  describe("Pausing", function () {
    it("Should allow platform admin to pause", async function () {
      await hackathonRegistry.connect(owner).pause();
      expect(await hackathonRegistry.paused()).to.equal(true);
    });
    
    it("Should not allow non-admin to pause", async function () {
      await expect(
        hackathonRegistry.connect(host).pause()
      ).to.be.reverted;
    });
    
    it("Should prevent operations when paused", async function () {
      await hackathonRegistry.connect(owner).pause();
      
      const initialVerifiers = [verifier1.address];
      
      await expect(
        hackathonRegistry.createHackathon(
          hackathonName,
          host.address,
          initialVerifiers,
          1,
          startDate,
          endDate
        )
      ).to.be.revertedWith("Pausable: paused");
    });
    
    it("Should allow platform admin to unpause", async function () {
      await hackathonRegistry.connect(owner).pause();
      await hackathonRegistry.connect(owner).unpause();
      expect(await hackathonRegistry.paused()).to.equal(false);
    });
  });
});