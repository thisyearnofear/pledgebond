// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./interfaces/IHackathonRegistry.sol";

/**
 * @title HackathonRegistry
 * @dev Registry for hackathons and their authorized verifiers
 * Manages the multisignature requirements for milestone verification
 */
contract HackathonRegistry is IHackathonRegistry, AccessControl, Pausable {
    using Counters for Counters.Counter;
    
    // Roles
    bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");
    bytes32 public constant HACKATHON_HOST_ROLE = keccak256("HACKATHON_HOST_ROLE");
    
    Counters.Counter private _hackathonIdCounter;
    
    struct HackathonVerifiers {
        address host;
        address[] verifiers;
        uint8 requiredSignatures;
        bool active;
        uint256 startDate;
        uint256 endDate;
        uint256 createdAt;
        string name;
    }

    // WinnerDeclaration is declared once, in IHackathonRegistry, so that
    // consumers (LiquidityRail) can decode it unambiguously.
    
    // Hackathon ID => Verifier Configuration
    mapping(uint256 => HackathonVerifiers) public hackathons;
    
    // Hackathon name => Hackathon ID (for lookup)
    mapping(string => uint256) public hackathonsByName;
    
    // Winner declarations: hackathonId => winnerAddress[] (ordered by declaration time)
    mapping(uint256 => IHackathonRegistry.WinnerDeclaration[]) public winnerDeclarations;
    
    // Events
    event HackathonCreated(uint256 indexed hackathonId, string name, address host, uint8 requiredSignatures);
    event VerifierAdded(uint256 indexed hackathonId, address verifier);
    event VerifierRemoved(uint256 indexed hackathonId, address verifier);
    event HackathonStatusChanged(uint256 indexed hackathonId, bool active);
    event RequiredSignaturesChanged(uint256 indexed hackathonId, uint8 previousRequired, uint8 newRequired);
    event WinnerDeclared(uint256 indexed hackathonId, address indexed winner, string projectName, uint256 prizeAmount, uint256 declaredAt);
    event PayoutRecorded(uint256 indexed hackathonId, address indexed winner, string payoutTxHash, uint256 paidAt);
    
    /**
     * @dev Constructor
     * Sets the deployer as the platform admin
     */
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(PLATFORM_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Creates a new hackathon with initial verifiers
     * @param name Unique name for the hackathon
     * @param host Address of the hackathon host
     * @param initialVerifiers Array of initial verifier addresses
     * @param requiredSignatures Number of signatures required for milestone approval
     * @return hackathonId Unique ID for the created hackathon
     */
    function createHackathon(
        string calldata name,
        address host,
        address[] calldata initialVerifiers,
        uint8 requiredSignatures,
        uint256 startDate,
        uint256 endDate
    )
        external 
        onlyRole(PLATFORM_ADMIN_ROLE) 
        whenNotPaused 
        returns (uint256) 
    {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(hackathonsByName[name] == 0, "Hackathon name already exists");
        require(host != address(0), "Invalid host address");
        require(initialVerifiers.length >= requiredSignatures, "Not enough initial verifiers");
        require(requiredSignatures > 0, "Required signatures must be greater than 0");
        require(startDate < endDate, "Start date must be before end date");
        
        // Ensure verifiers are unique
        for (uint i = 0; i < initialVerifiers.length; i++) {
            require(initialVerifiers[i] != address(0), "Invalid verifier address");
            
            for (uint j = i + 1; j < initialVerifiers.length; j++) {
                require(initialVerifiers[i] != initialVerifiers[j], "Duplicate verifier");
            }
        }
        
        // Increment hackathon ID counter (starts at 1)
        _hackathonIdCounter.increment();
        uint256 hackathonId = _hackathonIdCounter.current();
        
        // Store hackathon configuration
        hackathons[hackathonId] = HackathonVerifiers({
            host: host,
            verifiers: initialVerifiers,
            requiredSignatures: requiredSignatures,
            active: true,
            startDate: startDate,
            endDate: endDate,
            createdAt: block.timestamp,
            name: name
        });
        
        // Create name lookup
        hackathonsByName[name] = hackathonId;
        
        // Grant host role
        _grantRole(HACKATHON_HOST_ROLE, host);
        
        emit HackathonCreated(hackathonId, name, host, requiredSignatures);
        
        return hackathonId;
    }
    
    /**
     * @dev Adds a new verifier to a hackathon
     * @param hackathonId ID of the hackathon
     * @param verifier Address of the verifier to add
     */
    function addVerifier(uint256 hackathonId, address verifier) 
        external 
        whenNotPaused 
    {
        HackathonVerifiers storage hackathon = hackathons[hackathonId];
        
        require(hackathon.host != address(0), "Hackathon does not exist");
        require(
            hackathon.host == msg.sender || hasRole(PLATFORM_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(verifier != address(0), "Invalid verifier address");
        require(hackathon.active, "Hackathon is not active");
        
        // Check if verifier already exists
        for (uint i = 0; i < hackathon.verifiers.length; i++) {
            if (hackathon.verifiers[i] == verifier) {
                revert("Verifier already exists");
            }
        }
        
        hackathon.verifiers.push(verifier);
        emit VerifierAdded(hackathonId, verifier);
    }
    
    /**
     * @dev Removes a verifier from a hackathon
     * @param hackathonId ID of the hackathon
     * @param verifier Address of the verifier to remove
     */
    function removeVerifier(uint256 hackathonId, address verifier) 
        external 
        whenNotPaused 
    {
        HackathonVerifiers storage hackathon = hackathons[hackathonId];
        
        require(hackathon.host != address(0), "Hackathon does not exist");
        require(
            hackathon.host == msg.sender || hasRole(PLATFORM_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(hackathon.active, "Hackathon is not active");
        
        // Find and remove verifier
        bool found = false;
        for (uint i = 0; i < hackathon.verifiers.length; i++) {
            if (hackathon.verifiers[i] == verifier) {
                // Move the last element to the position being deleted
                hackathon.verifiers[i] = hackathon.verifiers[hackathon.verifiers.length - 1];
                // Remove the last element
                hackathon.verifiers.pop();
                found = true;
                break;
            }
        }
        
        require(found, "Verifier not found");
        require(
            hackathon.verifiers.length >= hackathon.requiredSignatures,
            "Would reduce verifiers below threshold"
        );
        
        emit VerifierRemoved(hackathonId, verifier);
    }
    
    /**
     * @dev Changes the required number of signatures for a hackathon
     * @param hackathonId ID of the hackathon
     * @param requiredSignatures New number of required signatures
     */
    function setRequiredSignatures(uint256 hackathonId, uint8 requiredSignatures) 
        external 
        whenNotPaused 
    {
        HackathonVerifiers storage hackathon = hackathons[hackathonId];
        
        require(hackathon.host != address(0), "Hackathon does not exist");
        require(
            hackathon.host == msg.sender || hasRole(PLATFORM_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(hackathon.active, "Hackathon is not active");
        require(requiredSignatures > 0, "Required signatures must be greater than 0");
        require(
            hackathon.verifiers.length >= requiredSignatures,
            "Not enough verifiers for requirement"
        );
        
        uint8 previousRequired = hackathon.requiredSignatures;
        hackathon.requiredSignatures = requiredSignatures;
        
        emit RequiredSignaturesChanged(hackathonId, previousRequired, requiredSignatures);
    }
    
    /**
     * @dev Changes the active status of a hackathon
     * @param hackathonId ID of the hackathon
     * @param active New active status
     */
    function setHackathonStatus(uint256 hackathonId, bool active) 
        external 
        whenNotPaused 
    {
        HackathonVerifiers storage hackathon = hackathons[hackathonId];
        
        require(hackathon.host != address(0), "Hackathon does not exist");
        require(
            hackathon.host == msg.sender || hasRole(PLATFORM_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        
        hackathon.active = active;
        
        emit HackathonStatusChanged(hackathonId, active);
    }
    
    /**
     * @dev Checks if an address is a verifier for a hackathon
     * @param hackathonId ID of the hackathon
     * @param account Address to check
     * @return True if the address is a verifier
     */
    function isVerifier(uint256 hackathonId, address account)
        external
        view
        override
        returns (bool)
    {
        HackathonVerifiers storage hackathon = hackathons[hackathonId];
        
        if (!hackathon.active) {
            return false;
        }
        
        for (uint i = 0; i < hackathon.verifiers.length; i++) {
            if (hackathon.verifiers[i] == account) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Checks whether a hackathon exists in the registry
     * @param hackathonId ID of the hackathon
     * @return True if the hackathon was created via createHackathon
     */
    function hackathonExists(uint256 hackathonId)
        external
        view
        override
        returns (bool)
    {
        return hackathons[hackathonId].host != address(0);
    }

    /**
     * @dev Gets the required number of signatures for a hackathon
     * @param hackathonId ID of the hackathon
     * @return Number of required signatures
     */
    function getRequiredSignatures(uint256 hackathonId)
        external
        view
        override
        returns (uint256)
    {
        return hackathons[hackathonId].requiredSignatures;
    }
    
    /**
     * @dev Gets all verifiers for a hackathon
     * @param hackathonId ID of the hackathon
     * @return Array of verifier addresses
     */
    function getHackathonVerifiers(uint256 hackathonId)
        external
        view
        override
        returns (address[] memory)
    {
        return hackathons[hackathonId].verifiers;
    }
    
    /**
     * @dev Gets hackathon ID by name
     * @param name Name of the hackathon
     * @return ID of the hackathon
     */
    function getHackathonIdByName(string calldata name) 
        external 
        view 
        returns (uint256) 
    {
        uint256 hackathonId = hackathonsByName[name];
        require(hackathonId > 0, "Hackathon not found");
        return hackathonId;
    }
    
    /**
     * @dev Gets hackathon details by ID
     * @param hackathonId ID of the hackathon
     * @return name The name of the hackathon
     * @return organizer The address of the hackathon organizer
     * @return startDate The start date of the hackathon
     * @return endDate The end date of the hackathon
     * @return isActive Whether the hackathon is active
     */
    function getHackathonDetails(uint256 hackathonId)
        external
        view
        override
        returns (
            string memory name,
            address organizer,
            uint256 startDate,
            uint256 endDate,
            bool isActive
        )
    {
        HackathonVerifiers storage hackathon = hackathons[hackathonId];
        require(hackathon.host != address(0), "Hackathon does not exist");
        
        return (
            hackathon.name,
            hackathon.host,
            hackathon.startDate,
            hackathon.endDate,
            hackathon.active
        );
    }
    
    /**
     * @dev Pauses the contract
     * Only callable by platform admin
     */
    function pause() external onlyRole(PLATFORM_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses the contract
     * Only callable by platform admin
     */
    function unpause() external onlyRole(PLATFORM_ADMIN_ROLE) {
        _unpause();
    }
    
    // ──────────────────────────────────────────────
    //  Winner & Payout Anchor
    // ──────────────────────────────────────────────
    
    /**
     * @dev Declares a winner for a hackathon with prize metadata.
     * Only callable by the hackathon host or a platform admin.
     * Anchors the declaration timestamp on-chain for payout latency computation.
     * @param hackathonId ID of the hackathon
     * @param winner Address of the winning participant
     * @param projectName Name of the winning project
     * @param prizeAmount Amount of the prize in USDC
     */
    function declareWinner(
        uint256 hackathonId,
        address winner,
        string calldata projectName,
        uint256 prizeAmount
    )
        external
        whenNotPaused
    {
        HackathonVerifiers storage hackathon = hackathons[hackathonId];
        
        require(hackathon.host != address(0), "Hackathon does not exist");
        require(
            hackathon.host == msg.sender || hasRole(PLATFORM_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(winner != address(0), "Invalid winner address");
        require(prizeAmount > 0, "Prize amount must be greater than 0");
        
        winnerDeclarations[hackathonId].push(WinnerDeclaration({
            winner: winner,
            projectName: projectName,
            prizeAmount: prizeAmount,
            declaredAt: block.timestamp,
            paidAt: 0,
            payoutTxHash: ""
        }));
        
        emit WinnerDeclared(hackathonId, winner, projectName, prizeAmount, block.timestamp);
    }
    
    /**
     * @dev Records a payout for a previously declared winner.
     * Called when the actual USDC transfer settles (by host, admin, or verifier agent).
     * Completes the time delta: declaredAt → paidAt.
     * @param hackathonId ID of the hackathon
     * @param winner Address of the winner being paid
     * @param payoutTxHash Transaction hash of the USDC payout
     */
    function recordPayout(
        uint256 hackathonId,
        address winner,
        string calldata payoutTxHash
    )
        external
        whenNotPaused
    {
        HackathonVerifiers storage hackathon = hackathons[hackathonId];
        
        require(hackathon.host != address(0), "Hackathon does not exist");
        require(
            hackathon.host == msg.sender || 
            hasRole(PLATFORM_ADMIN_ROLE, msg.sender) ||
            this.isVerifier(hackathonId, msg.sender),
            "Not authorized"
        );
        
        WinnerDeclaration[] storage declarations = winnerDeclarations[hackathonId];
        bool found = false;
        
        // Find the latest unpaid declaration for this winner
        for (uint256 i = declarations.length; i > 0; i--) {
            WinnerDeclaration storage decl = declarations[i - 1];
            if (decl.winner == winner && decl.paidAt == 0) {
                decl.paidAt = block.timestamp;
                decl.payoutTxHash = payoutTxHash;
                found = true;
                break;
            }
        }
        
        require(found, "No unpaid declaration found for this winner");
        
        emit PayoutRecorded(hackathonId, winner, payoutTxHash, block.timestamp);
    }
    
    /**
     * @dev Gets all winner declarations for a hackathon
     * @param hackathonId ID of the hackathon
     * @return Array of winner declarations
     */
    function getWinnerDeclarations(uint256 hackathonId)
        external
        view
        returns (IHackathonRegistry.WinnerDeclaration[] memory)
    {
        return winnerDeclarations[hackathonId];
    }
    
    /**
     * @dev Gets the number of winners declared for a hackathon
     * @param hackathonId ID of the hackathon
     * @return Count of winner declarations
     */
    function getWinnerCount(uint256 hackathonId)
        external
        view
        returns (uint256)
    {
        return winnerDeclarations[hackathonId].length;
    }
    
    /**
     * @dev Gets payout statistics for a hackathon
     * @param hackathonId ID of the hackathon
     * @return totalWinners Total number of winners declared
     * @return paidWinners Number of winners who have been paid
     * @return totalPrizeAmount Sum of all declared prizes
     * @return minPayoutLatency Minimum payout latency in seconds
     * @return maxPayoutLatency Maximum payout latency in seconds
     */
    function getPayoutStats(uint256 hackathonId)
        external
        view
        returns (
            uint256 totalWinners,
            uint256 paidWinners,
            uint256 totalPrizeAmount,
            uint256 minPayoutLatency,
            uint256 maxPayoutLatency
        )
    {
        WinnerDeclaration[] storage declarations = winnerDeclarations[hackathonId];
        
        totalWinners = declarations.length;
        minPayoutLatency = type(uint256).max;
        maxPayoutLatency = 0;
        
        for (uint256 i = 0; i < declarations.length; i++) {
            totalPrizeAmount += declarations[i].prizeAmount;
            
            if (declarations[i].paidAt > 0) {
                paidWinners++;
                
                uint256 latency = declarations[i].paidAt - declarations[i].declaredAt;
                if (latency < minPayoutLatency) minPayoutLatency = latency;
                if (latency > maxPayoutLatency) maxPayoutLatency = latency;
            }
        }
        
        // No paid winners means min/max are 0
        if (paidWinners == 0) {
            minPayoutLatency = 0;
            maxPayoutLatency = 0;
        }
    }
}