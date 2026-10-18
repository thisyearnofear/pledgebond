// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IHackathonRegistry
 * @dev Interface for the HackathonRegistry contract
 * Provides functions for verifying hackathon verifiers, signature requirements,
 * and winner/payout anchoring.
 */
interface IHackathonRegistry {
    /**
     * @dev A recorded win, with the declaredAt/paidAt pair that makes an
     * unpaid prize legible as an asset and a builder's payment history public.
     */
    struct WinnerDeclaration {
        address winner;
        string projectName;
        uint256 prizeAmount;
        uint256 declaredAt;
        uint256 paidAt;
        string payoutTxHash;
    }

    /**
     * @dev Checks if an address is an authorized verifier for a hackathon
     * @param hackathonId ID of the hackathon
     * @param verifier Address to check
     * @return bool True if the address is a verifier, false otherwise
     */
    function isVerifier(uint256 hackathonId, address verifier) external view returns (bool);
    
    /**
     * @dev Gets the number of required signatures for a hackathon's milestone verification
     * @param hackathonId ID of the hackathon
     * @return uint256 The number of required signatures
     */
    function getRequiredSignatures(uint256 hackathonId) external view returns (uint256);
    
    /**
     * @dev Checks whether a hackathon exists in the registry
     * @param hackathonId ID of the hackathon
     * @return bool True if the hackathon was created via createHackathon
     */
    function hackathonExists(uint256 hackathonId) external view returns (bool);
    
    /**
     * @dev Gets hackathon details by ID
     * @param hackathonId ID of the hackathon
     * @return name The name of the hackathon
     * @return organizer The address of the hackathon organizer
     * @return startDate The start date of the hackathon
     * @return endDate The end date of the hackathon
     * @return isActive Whether the hackathon is active
     */
    function getHackathonDetails(uint256 hackathonId) external view returns (
        string memory name,
        address organizer,
        uint256 startDate,
        uint256 endDate,
        bool isActive
    );
    
    /**
     * @dev Gets all verifiers for a hackathon
     * @param hackathonId ID of the hackathon
     * @return Array of verifier addresses
     */
    function getHackathonVerifiers(uint256 hackathonId) external view returns (address[] memory);
    
    /**
     * @dev Declares a winner for a hackathon with prize metadata.
     * Anchors the declaration timestamp on-chain.
     * @return declarationIndex The declaration's position — consumers bind to it.
     */
    function declareWinner(
        uint256 hackathonId,
        address winner,
        string calldata projectName,
        uint256 prizeAmount
    ) external returns (uint256 declarationIndex);
    
    /**
     * @dev Attests a payout for a specific declaration. paidAt is set only
     * once requiredSignatures distinct verifiers attest — index-exact, never
     * inferred from the winner address.
     * @return finalized True when this attestation set paidAt.
     */
    function recordPayout(
        uint256 hackathonId,
        uint256 declarationIndex,
        string calldata payoutTxHash
    ) external returns (bool finalized);
    
    /**
     * @dev Gets all winner declarations for a hackathon.
     * Used to verify that a specific builder's payout was actually recorded,
     * not merely that the hackathon paid some other winner.
     */
    function getWinnerDeclarations(uint256 hackathonId) external view returns (WinnerDeclaration[] memory);

    /**
     * @dev Gets a single declaration by index. Reverts out of range.
     */
    function getDeclaration(uint256 hackathonId, uint256 index) external view returns (WinnerDeclaration memory);
    
    /**
     * @dev Gets payout statistics for a hackathon
     */
    function getPayoutStats(uint256 hackathonId) external view returns (
        uint256 totalWinners,
        uint256 paidWinners,
        uint256 totalPrizeAmount,
        uint256 minPayoutLatency,
        uint256 maxPayoutLatency
    );
}