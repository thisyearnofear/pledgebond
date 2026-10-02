/**
 * Credit Service — viem-based contract interactions
 */
import { getContract, formatUnits, parseUnits, maxUint256 } from 'viem';
import type { PublicClient, WalletClient } from 'viem';

import { BUILDER_CREDIT_CORE_ABI, ERC20_ABI, HACKATHON_REGISTRY_ABI } from '../constants/abis';
import { BUILDER_CREDIT_CORE_ADDRESSES, USDC_ADDRESSES, HACKATHON_REGISTRY_ADDRESSES } from '../config/tokens';
import type { ProjectData, ProjectBackingData, ProjectDetails } from '../lib/chains/types';

// ABIs are in human-readable format; cast for viem (tuple() syntax not supported by parseAbi)
const coreAbi = BUILDER_CREDIT_CORE_ABI as unknown as readonly any[];
const erc20Abi = ERC20_ABI as unknown as readonly any[];
const registryAbi = HACKATHON_REGISTRY_ABI as unknown as readonly any[];

interface Contracts {
    core: any;
    usdc: any;
    registry: any;
    coreAddress: `0x${string}`;
}

class CreditService {
    getContracts(chainId: number | undefined, publicClient: PublicClient, walletClient?: WalletClient): Contracts | null {
        if (!chainId) return null;
        const coreAddress = (BUILDER_CREDIT_CORE_ADDRESSES as Record<number, string>)[chainId] as `0x${string}`;
        const usdcAddress = (USDC_ADDRESSES as Record<number, string>)[chainId] as `0x${string}`;
        const registryAddress = (HACKATHON_REGISTRY_ADDRESSES as Record<number, string>)[chainId] as `0x${string}`;
        if (!coreAddress || !usdcAddress || !registryAddress) {
            throw new Error(`Platform not supported on network ${chainId}`);
        }
        const client = walletClient
            ? { public: publicClient, wallet: walletClient }
            : { public: publicClient };
        return {
            core: getContract({ address: coreAddress, abi: coreAbi, client }),
            usdc: getContract({ address: usdcAddress, abi: erc20Abi, client }),
            registry: getContract({ address: registryAddress, abi: registryAbi, client }),
            coreAddress,
        };
    }

    async requestFunding(chainId: number, publicClient: PublicClient, walletClient: WalletClient, projectData: ProjectData) {
        const contracts = this.getContracts(chainId, publicClient, walletClient);
        if (!contracts) throw new Error("Contracts not found");
        const { hackathonIds, githubUrl, projectName, milestoneDescriptions, milestoneAmounts } = projectData;
        const amounts = milestoneAmounts.map(a => parseUnits(a.toString(), 6));
        const hash = await contracts.core.write.requestFunding([hackathonIds, githubUrl, projectName, milestoneDescriptions, amounts] as any);
        return await publicClient.waitForTransactionReceipt({ hash });
    }

    async repayLoan(chainId: number, publicClient: PublicClient, walletClient: WalletClient, amount: string | number) {
        const contracts = this.getContracts(chainId, publicClient, walletClient);
        if (!contracts) throw new Error("Contracts not found");
        const amountUnits = parseUnits(amount.toString(), 6);
        const account = walletClient.account!.address;
        const allowance = await contracts.usdc.read.allowance([account, contracts.coreAddress]) as bigint;
        if (allowance < amountUnits) {
            const approveTx = await contracts.usdc.write.approve([contracts.coreAddress, maxUint256] as any);
            await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
        const hash = await contracts.core.write.repayLoan([amountUnits] as any);
        return await publicClient.waitForTransactionReceipt({ hash });
    }

    async backProject(chainId: number, publicClient: PublicClient, walletClient: WalletClient, projectId: number | string, multiplier: number, amount: string | number) {
        const contracts = this.getContracts(chainId, publicClient, walletClient);
        if (!contracts) throw new Error('Contracts not found');
        const pid = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
        const amountUnits = parseUnits(amount.toString(), 6);
        const hash = await contracts.core.write.backProject([pid, multiplier, amountUnits] as any);
        return await publicClient.waitForTransactionReceipt({ hash });
    }

    async postCheckIn(chainId: number, publicClient: PublicClient, walletClient: WalletClient, projectId: number, metadata: string) {
        const contracts = this.getContracts(chainId, publicClient, walletClient);
        if (!contracts) throw new Error("Contracts not found");
        const hash = await contracts.core.write.postCheckIn([projectId, metadata] as any);
        return await publicClient.waitForTransactionReceipt({ hash });
    }

    async getProjectBackingData(chainId: number, publicClient: PublicClient, projectId: string | number): Promise<ProjectBackingData> {
        const contracts = this.getContracts(chainId, publicClient);
        if (!contracts) throw new Error("Contracts not found");

        const projectIdNum = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;

        try {
            const totalBacking = await contracts.core.read.totalProjectBacking([projectIdNum] as any) as bigint;
            const project = await contracts.core.read.projects([projectIdNum] as any) as any;
            const creditScore = Number(project.creditScore || 400);
            const maxMultiplier = this.calculateMaxMultiplier(creditScore);
            const backerCount = await this.getBackerCount(chainId, publicClient, projectIdNum);

            return {
                totalBacking: formatUnits(totalBacking || 0n, 6),
                backerCount,
                maxMultiplier,
                creditScore
            };
        } catch (err) {
            console.warn('Failed to load project backing data:', err);
            return { totalBacking: '0', backerCount: 0, maxMultiplier: 300, creditScore: 400 };
        }
    }

    async getBackerCount(chainId: number, publicClient: PublicClient, projectId: number): Promise<number> {
        const contracts = this.getContracts(chainId, publicClient);
        if (!contracts) return 0;
        try {
            const count = await contracts.core.read.getProjectBackerCount([projectId] as any) as bigint;
            return Number(count);
        } catch {
            return 0;
        }
    }

    calculateMaxMultiplier(creditScore: number): number {
        if (creditScore >= 800) return 150;
        if (creditScore >= 700) return 200;
        if (creditScore >= 600) return 250;
        return 300;
    }

    calculateBaseFunding(creditScore: number): number {
        if (creditScore < 400) return 0;
        if (creditScore >= 800) return 5000;
        const minFunding = 500;
        const maxFunding = 5000;
        const scoreRange = 800 - 400;
        const adjustedScore = creditScore - 400;
        return minFunding + (maxFunding - minFunding) * adjustedScore / scoreRange;
    }

    async getProjectDetails(chainId: number, publicClient: PublicClient, projectId: string | number): Promise<ProjectDetails | null> {
        const contracts = this.getContracts(chainId, publicClient);
        if (!contracts) return null;
        try {
            const projectIdNum = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
            const project = await contracts.core.read.projects([projectIdNum] as any) as any;
            if (!project.developer || project.developer === '0x0000000000000000000000000000000000000000') return null;
            return {
                isActive: project.isActive,
                creditScore: Number(project.creditScore || 400),
                fundingAmount: formatUnits(project.fundingAmount || 0n, 6),
                milestonesCompleted: Number(project.milestonesCompleted || 0),
                milestonesCount: Number(project.milestonesCount || 0)
            };
        } catch (err) {
            console.warn('Failed to load project details:', err);
            return null;
        }
    }
}

export const creditService = new CreditService();
export default creditService;
