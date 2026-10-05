import { PublicKey } from '@solana/web3.js';
import { BagsSDK } from '@bagsfm/bags-sdk';
import { getSolanaConnection } from '../lib/chains/solanaConnection';

/**
 * Solana Bags service — token launch and fee-share claims for the "bags"
 * capital rail (coming soon on the public site).
 *
 * The legacy credit-line Anchor program (credit lines, reputation,
 * back_project multipliers, milestone vaults) was retired with the
 * liquidity-rail pivot — see docs/VISION.md and blockchain/
 * contracts/LiquidityRail.sol. Only the Bags SDK integration remains.
 */

class SolanaBagsService {
    private bagsClient: BagsSDK | null = null;

    constructor() {
        const apiKey = process.env.NEXT_PUBLIC_BAGS_API_KEY;
        if (apiKey) {
            this.bagsClient = new BagsSDK(
                apiKey,
                getSolanaConnection(),
            );
        }
    }

    getCluster(): string {
        return (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet').toLowerCase();
    }

    async launchBagsToken(bagsTokenMetadata: { name: string; symbol: string; description: string }) {
        if (!this.bagsClient) {
            throw new Error("Bags SDK not initialized (API Key missing)");
        }
        if (!bagsTokenMetadata?.name || !bagsTokenMetadata?.symbol) {
            throw new Error("Bags token metadata missing");
        }
        console.log('Bags: Launching token', bagsTokenMetadata);
        const launchResult = await (this.bagsClient as any).token.launchV2({
            metadata: bagsTokenMetadata,
        });
        return {
            success: true,
            mint: launchResult.mint,
            signature: launchResult.signature
        };
    }

    async getClaimableFees(walletPublicKey: PublicKey) {
        if (!this.bagsClient) return [];
        return await (this.bagsClient as any).fee.getAllClaimablePositions(walletPublicKey.toBase58());
    }

    async claimFees(wallet: any, positions: any[]) {
        if (!this.bagsClient) throw new Error("Bags SDK not initialized");
        const tx = await (this.bagsClient as any).fee.getClaimTransactions({
            wallet: wallet.publicKey.toBase58(),
            positions: positions.map(p => p.id),
        });
        const signed = await wallet.signAllTransactions(tx);
        return signed;
    }
}

export const solanaBagsService = new SolanaBagsService();
export default solanaBagsService;
