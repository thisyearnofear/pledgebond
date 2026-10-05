/**
 * useWalletStore — EVM + Solana + Circle + Credit + Nanopayment + LiFi.
 *
 * Replaces WalletContext + CircleContext + CreditContext + FinancialContext +
 * NanopaymentContext (5 contexts collapsed into one store, per the Phase 3
 * plan). Backward-compat hooks (`useBuilderCredit`, `useCircleWallet`,
 * `useNanopayment`, `useFinancial`) preserve the consumer import surface so
 * the migration is mechanical.
 *
 * Hydrator pattern: wagmi and Solana wallet adapter hooks only work inside
 * a React component. `EvmWalletHydrator` and `SolanaWalletHydrator`
 * (mounted once each in AppProviders) read those hooks and write the live
 * values to the store. Other components read via `useWalletStore()`.
 *
 * Dead surface removed (see audit):
 * - `error` (WalletContext — never written)
 * - `streamingPayment` (Nanopayment — never assigned)
 * - `coreContract` / `usdcContract` / `hackathonRegistryContract` /
 *   `loadUserData` / `formatUSDC` / `contractError` (all null; silently
 *   undefined at destructure sites)
 * - `requestCredit` (calls non-existent ABI, 0 external consumers)
 * - `lifiInitialized` / `availableChains` / `availableTokens`
 *   (pre-existing init bug, never set)
 * - `getRoutes` / `getChainIcon` / `getChainLogoURI` / `getTokenLogoURI` /
 *   `usdcAddresses` (no external consumers)
 * - `agentPrices` (exposed but never read; duplicate of `AGENT_PRICES`)
 */

import { useEffect } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import {
  useWallet as useSolanaWalletAdapter,
  useConnection as useSolanaConnectionAdapter,
} from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { formatEther } from "viem";
import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/clientApp";
import { walletService } from "@/services/walletService";
import { liquidityRailService } from "@/services/liquidityRailService";
import { nanopaymentService } from "@/services/nanopaymentService";
import { crossChainUSDCService } from "@/lib/lifiIntegration";
import { createStore, useStore, type Store } from "./createStore";

// ============================================================================
// Store
// ============================================================================

export interface WalletState {
  evm: {
    account: string | undefined;
    chainId: number | undefined;
    publicClient: any;
    walletClient: any;
    connected: boolean;
    connecting: boolean;
    balance: string | null;
  };
  solana: {
    address: string | null;
    connected: boolean;
    connecting: boolean;
    balance: string | null;
    wallet: any;
  };
  activeChainFamily: "evm" | "solana";
  rail: {
    credibility: any;
    positions: any[];
    loading: boolean;
    usdcBalance: string;
    chainBalances: Record<string, string>;
    developerProjects: any[];
    projectDetails: any[];
    loadingProjects: boolean;
    isFetchingBalances: boolean;
  };
  nanopayment: {
    isInitialized: boolean;
    balance: { available: string; locked: string };
    transactions: any[];
    demoMode: boolean;
    walletAddress: string | null;
    loading: boolean;
    error: string | null;
  };
  lifi: {
    transferHistory: any[];
    loading: boolean;
    error: string | null;
  };
  circle: {
    wallets: any[];
    config: any;
    loading: boolean;
  };
}

const initialState: WalletState = {
  evm: { account: undefined, chainId: undefined, publicClient: null, walletClient: null, connected: false, connecting: false, balance: null },
  solana: { address: null, connected: false, connecting: false, balance: null, wallet: null },
  activeChainFamily: "evm",
  rail: { credibility: null, positions: [], loading: false, usdcBalance: "0.00", chainBalances: {}, developerProjects: [], projectDetails: [], loadingProjects: false, isFetchingBalances: false },
  nanopayment: { isInitialized: false, balance: { available: "0", locked: "0" }, transactions: [], demoMode: false, walletAddress: null, loading: false, error: null },
  lifi: { transferHistory: [], loading: false, error: null },
  circle: { wallets: [], config: null, loading: false },
};

export const walletStore: Store<WalletState> = createStore<WalletState>(initialState);

// ============================================================================
// EVM actions
// ============================================================================

function setActiveChainFamily(family: "evm" | "solana") {
  walletStore.setState({ activeChainFamily: family });
}

function disconnectEvm() {
  walletStore.setState((s) => ({ evm: { ...s.evm, account: undefined, connected: false, balance: null } }));
}

function disconnectSolana() {
  walletStore.setState((s) => ({ solana: { ...s.solana, address: null, connected: false, balance: null, wallet: null } }));
}

// ============================================================================
// Credit actions (delegate to existing services)
// ============================================================================

/** EVM-only rail. The LiquidityRail contract has no Solana counterpart yet. */
function requireRail() {
  const { activeChainFamily, evm } = walletStore.getState();
  if (activeChainFamily === "solana") {
    throw new Error("The liquidity rail is EVM-only for now.");
  }
  if (!evm.publicClient || !evm.walletClient || !evm.chainId) {
    throw new Error("EVM wallet not connected");
  }
  return { chainId: evm.chainId, publicClient: evm.publicClient, walletClient: evm.walletClient };
}

async function declareWin(args: { hackathonId: number; builder: string; projectName: string; prizeAmount: string }) {
  const ctx = requireRail();
  return liquidityRailService.declareWin(ctx.chainId, ctx.publicClient, ctx.walletClient!, args);
}

async function openLoan(winId: number, terms: any) {
  const ctx = requireRail();
  return liquidityRailService.openLoan(ctx.chainId, ctx.publicClient, ctx.walletClient!, winId, terms);
}

async function settleLoan(winId: number) {
  const ctx = requireRail();
  return liquidityRailService.settleLoan(ctx.chainId, ctx.publicClient, winId);
}

/** Reads rail state for the connected builder. Never throws. */
async function loadRailState() {
  const { evm, activeChainFamily } = walletStore.getState();
  if (activeChainFamily === "solana" || !evm.publicClient || !evm.chainId || !evm.account) {
    walletStore.setState((s) => ({ rail: { ...s.rail, credibility: null, positions: [], loading: false } }));
    return;
  }
  walletStore.setState((s) => ({ rail: { ...s.rail, loading: true } }));
  try {
    const credibility = await liquidityRailService.getBuilderCredibility(
      evm.chainId,
      evm.publicClient,
      evm.account
    );
    walletStore.setState((s) => ({ rail: { ...s.rail, credibility, loading: false } }));
  } catch {
    walletStore.setState((s) => ({ rail: { ...s.rail, loading: false } }));
  }
}

async function getUSDCBalanceAsync(): Promise<string> {
  const { evm, solana, activeChainFamily } = walletStore.getState();
  let balance = "0.00";
  if (activeChainFamily === "solana" && solana.address) {
    balance = solana.balance || "0.00";
  } else if (evm.publicClient && evm.account) {
    try {
      const bal = await evm.publicClient.getBalance({ address: evm.account as `0x${string}` });
      balance = formatEther(bal);
    } catch {
      balance = "0.00";
    }
  }
  walletStore.setState((s) => ({ rail: { ...s.rail, usdcBalance: balance } }));
  return balance;
}

async function loadUserProjects(githubUsername: string, uid: string) {
  walletStore.setState((s) => ({ rail: { ...s.rail, loadingProjects: true } }));
  try {
    const projectsRef = collection(db, "projects");
    const byGithub = await getDocs(query(projectsRef, where("submittedBy", "==", githubUsername)));
    const byOwners = await getDocs(query(projectsRef, where("owners", "array-contains", uid)));
    const seen = new Set<string>();
    const projects: any[] = [];
    for (const d of [...byGithub.docs, ...byOwners.docs]) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      projects.push({ id: d.id, ...d.data() });
    }
    projects.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    walletStore.setState((s) => ({
      rail: { ...s.rail, developerProjects: projects, loadingProjects: false },
    }));
  } catch {
    walletStore.setState((s) => ({ rail: { ...s.rail, loadingProjects: false } }));
  }
}

// ============================================================================
// Nanopayment actions
// ============================================================================

function setNanopaymentDemoMode(mode: boolean) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("nanopayment-test-mode", String(mode));
  }
  walletStore.setState((s) => ({ nanopayment: { ...s.nanopayment, demoMode: mode } }));
}

function initializeWithDemo() {
  walletStore.setState((s) => ({
    nanopayment: {
      ...s.nanopayment,
      isInitialized: true,
      walletAddress: "0xDEMO",
      balance: { available: "10.00", locked: "0" },
      loading: false,
    },
  }));
}

async function initialize(config: { chain: string; privateKey: `0x${string}`; gatewayWalletAddress?: string }) {
  walletStore.setState((s) => ({ nanopayment: { ...s.nanopayment, loading: true } }));
  try {
    const client = await nanopaymentService.initialize(config);
    walletStore.setState((s) => ({
      nanopayment: { ...s.nanopayment, isInitialized: true, walletAddress: config.gatewayWalletAddress || null, loading: false },
    }));
    return client;
  } catch (err: any) {
    walletStore.setState((s) => ({ nanopayment: { ...s.nanopayment, loading: false, error: err.message } }));
    throw err;
  }
}

async function deposit(amountUSDC: number) {
  await nanopaymentService.deposit(amountUSDC);
  const balance = await nanopaymentService.getBalance();
  walletStore.setState((s) => ({ nanopayment: { ...s.nanopayment, balance } }));
}

async function payForAgent(agentType: string, params: any = {}) {
  const url = buildAgentUrl(agentType, params);
  // Underwrite is sponsored-first: the server funds the first N calls per
  // user (agentSponsorship) so new backers get value before the x402 toll.
  // Other agents keep the direct paid path.
  if (agentType === "underwrite") {
    const result = await nanopaymentService.payOrSponsor(url);
    const transactions = [result, ...walletStore.getState().nanopayment.transactions].slice(0, 50);
    walletStore.setState((s) => ({ nanopayment: { ...s.nanopayment, transactions } }));
    return result;
  }
  const result = await nanopaymentService.pay(url, { method: "GET" });
  const transactions = [result, ...walletStore.getState().nanopayment.transactions].slice(0, 50);
  walletStore.setState((s) => ({ nanopayment: { ...s.nanopayment, transactions } }));
  return result;
}

function buildAgentUrl(agentType: string, params: any) {
  const base = params.baseUrl || "";
  switch (agentType) {
    case "scout": return `${base}/api/agent/scout`;
    case "underwrite": return `${base}/api/agent/underwrite?projectId=${params.projectId}`;
    case "verify": return `${base}/api/agent/verify?prId=${params.prId}&lines=${params.lines}`;
    case "chat": return `${base}${params.endpoint}`;
    default: return `${base}/api/agent/${agentType}`;
  }
}

async function payForScout(baseUrl?: string) { return payForAgent("scout", { baseUrl }); }
async function payForUnderwrite(projectId: string, baseUrl?: string) { return payForAgent("underwrite", { projectId, baseUrl }); }
async function payForVerification(prId: string, lines: number, baseUrl?: string) { return payForAgent("verify", { prId, lines, baseUrl }); }
async function pay(endpoint: string, options?: any) { return payForAgent("chat", { endpoint, ...options }); }

// ============================================================================
// LiFi / Financial actions
// ============================================================================

function loadTransferHistory() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem("lifi_transfer_history");
    if (raw) {
      const history = JSON.parse(raw);
      walletStore.setState((s) => ({ lifi: { ...s.lifi, transferHistory: history } }));
    }
  } catch {}
}

function persistTransferHistory(history: any[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("lifi_transfer_history", JSON.stringify(history));
  } catch {}
}

async function getTransferQuote(args: {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
}) {
  return crossChainUSDCService.getTransferQuote(args);
}

async function executeTransfer(route: any, signer: any) {
  walletStore.setState((s) => ({ lifi: { ...s.lifi, loading: true } }));
  try {
    const result = await crossChainUSDCService.executeTransfer(route, signer);
    const history = [result, ...walletStore.getState().lifi.transferHistory].slice(0, 50);
    persistTransferHistory(history);
    walletStore.setState((s) => ({ lifi: { ...s.lifi, transferHistory: history, loading: false } }));
    return result;
  } catch (err: any) {
    walletStore.setState((s) => ({ lifi: { ...s.lifi, loading: false, error: err.message } }));
    throw err;
  }
}

async function getTransferStatus(txHash: string, fromChainId: number) {
  return crossChainUSDCService.getTransferStatus(txHash, fromChainId);
}

// ============================================================================
// Circle actions
// ============================================================================

async function createCircleWallet(config: any = {}) {
  return walletService.createWallet(config);
}

async function transferUSDC(amount: string, destinationAddress: string, walletId: string, reason?: string) {
  return walletService.transferUSDC({ amount, destinationAddress, walletId, metadata: reason ? { reason } : undefined });
}

async function refreshCircleWallets() {
  try {
    const config = await walletService.getConfig();
    walletStore.setState((s) => ({ circle: { ...s.circle, config } }));
    if (config?.configured) {
      const wallets = await walletService.getWallets();
      walletStore.setState((s) => ({ circle: { ...s.circle, wallets } }));
    }
  } catch {}
}

function isCircleConfigured() {
  return walletStore.getState().circle.config?.configured === true;
}

// ============================================================================
// Init + Hydrator
// ============================================================================

let initialized = false;
export function initWalletStore() {
  if (initialized) return;
  initialized = true;
  if (typeof window === "undefined") return;
  loadTransferHistory();
  const demo = window.localStorage.getItem("nanopayment-test-mode") === "true";
  walletStore.setState((s) => ({ nanopayment: { ...s.nanopayment, demoMode: demo } }));
  refreshCircleWallets();
}

export function EvmWalletHydrator() {
  const account = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    walletStore.setState((s) => ({
      evm: {
        ...s.evm,
        account: account.address as any,
        connected: account.isConnected,
        connecting: account.isConnecting,
        chainId,
        publicClient,
        walletClient,
      },
    }));
  }, [account.address, account.isConnected, account.isConnecting, chainId, publicClient, walletClient]);

  useEffect(() => {
    if (!account.address || !publicClient) return;
    let cancelled = false;
    (async () => {
      try {
        const bal = await publicClient.getBalance({ address: account.address as `0x${string}` });
        if (!cancelled) {
          walletStore.setState((s) => ({ evm: { ...s.evm, balance: formatEther(bal) } }));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [account.address, publicClient]);

  return null;
}

export function SolanaWalletHydrator() {
  const solana = useSolanaWalletAdapter();
  const solanaConn = useSolanaConnectionAdapter();

  useEffect(() => {
    walletStore.setState((s) => ({
      solana: {
        ...s.solana,
        address: solana.publicKey?.toBase58() || null,
        connected: solana.connected,
        connecting: solana.connecting,
        wallet: solana.wallet,
      },
    }));
  }, [solana.publicKey, solana.connected, solana.connecting, solana.wallet]);

  useEffect(() => {
    if (!solana.publicKey || !solanaConn.connection) return;
    let cancelled = false;
    (async () => {
      try {
        const bal = await solanaConn.connection.getBalance(solana.publicKey!);
        if (!cancelled) {
          walletStore.setState((s) => ({ solana: { ...s.solana, balance: (bal / LAMPORTS_PER_SOL).toString() } }));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [solana.publicKey, solanaConn.connection]);

  return null;
}

// ============================================================================
// Hooks (backward-compat shapes)
// ============================================================================

export const useWalletStore = <T,>(selector: (s: WalletState) => T) => useStore(walletStore, selector);

export function useWallet() {
  const s = useStore(walletStore, (st) => st);
  return {
    account: s.evm.account,
    address: s.evm.account,
    chainId: s.evm.chainId,
    balance: s.evm.balance,
    publicClient: s.evm.publicClient,
    walletClient: s.evm.walletClient,
    connected: s.evm.connected,
    connecting: s.evm.connecting,
    solanaAddress: s.solana.address,
    solanaConnected: s.solana.connected,
    solanaConnecting: s.solana.connecting,
    solanaBalance: s.solana.balance,
    solanaWallet: s.solana.wallet,
    activeChainFamily: s.activeChainFamily,
    setActiveChainFamily,
    disconnect: disconnectEvm,
    disconnectSolana,
    getUSDCBalance: getUSDCBalanceAsync,
    getTokenBalance: async () => "0",
    getBalance: async () => s.evm.balance,
    getCurrentUSDCAddress: () => null,
  };
}

export function useCircleWallet() {
  const s = useStore(walletStore, (st) => st.circle);
  return {
    circleWallets: s.wallets,
    circleConfig: s.config,
    loading: s.loading,
    createWallet: createCircleWallet,
    refreshWallets: refreshCircleWallets,
    transferUSDC,
    isConfigured: isCircleConfigured,
    getEnvironment: () => s.config?.environment || "sandbox",
  };
}

export function useBuilderCredit() {
  const s = useStore(walletStore, (st) => st);
  return {
    creditProfile: s.rail.credibility,
    railCredibility: s.rail.credibility,
    positions: s.rail.positions,
    railLoading: s.rail.loading,
    developerProjects: s.rail.developerProjects,
    projectDetails: s.rail.projectDetails,
    loadingProjects: s.rail.loadingProjects,
    usdcBalance: s.rail.usdcBalance,
    chainBalances: s.rail.chainBalances,
    isFetchingBalances: s.rail.isFetchingBalances,
    activeChainFamily: s.activeChainFamily,
    chainId: s.evm.chainId,
    account: s.evm.account,
    address: s.evm.account,
    connected: s.evm.connected || s.solana.connected,
    signer: s.evm.walletClient,
    contractLoading: false,
    declareWin,
    openLoan,
    settleLoan,
    loadRailState,
    switchChain: setActiveChainFamily,
    getUSDCBalanceAsync,
    loadUserProjects,
  };
}
export function useNanopayment() {
  const s = useStore(walletStore, (st) => st.nanopayment);
  return {
    isInitialized: s.isInitialized,
    nanopaymentDemoMode: s.demoMode,
    setNanopaymentDemoMode,
    loading: s.loading,
    error: s.error,
    balance: s.balance,
    walletAddress: s.walletAddress,
    transactions: s.transactions,
    initialize,
    initializeWithDemo,
    deposit,
    pay,
    payForAgent,
    payForScout,
    payForUnderwrite,
    payForVerification,

  };
}

export function useFinancial() {
  const s = useStore(walletStore, (st) => st.lifi);
  return {
    transferHistory: s.transferHistory,
    lifiLoading: s.loading,
    lifiError: s.error,
    getQuote: getTransferQuote,
    executeTransfer,
    getTransferStatus,
    updateTransferStatuses: async () => {},
  };
}

export const useLiFi = useFinancial;

export const useCircle = useCircleWallet;

export const walletActions = {
  setActiveChainFamily,
  disconnect: disconnectEvm,
  disconnectSolana,
  declareWin,
  openLoan,
  settleLoan,
  getUSDCBalance: getUSDCBalanceAsync,
  loadRailState,
  loadUserProjects,
  setNanopaymentDemoMode,
  initializeWithDemo,
  initialize,
  deposit,
  payForAgent,
  payForScout,
  payForUnderwrite,
  payForVerification,
  pay,
  getQuote: getTransferQuote,
  executeTransfer,
  getTransferStatus,
  createCircleWallet,
  transferUSDC,
  refreshCircleWallets,
  isCircleConfigured,
};
