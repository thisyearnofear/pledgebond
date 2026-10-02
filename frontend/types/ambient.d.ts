/* Ambient declarations for packages without published types */

declare module "@circle-fin/developer-controlled-wallets" {
  export interface CircleDeveloperControlledWalletsClient {
    createWallet(params: any): Promise<any>;
    createWallets(params: any): Promise<any>;
    listWallets(params?: any): Promise<any>;
    getWallet(params: { id: string; walletId?: string }): Promise<any>;
    createTransaction(params: any): Promise<any>;
    createContractExecutionTransaction(params: any): Promise<any>;
    getTransaction(params: { id: string }): Promise<any>;
    getWalletTokenBalance(params: { walletId: string; id?: string }): Promise<any>;
  }
  export function initiateDeveloperControlledWalletsClient(
    config: { apiKey: string; entitySecret: string }
  ): CircleDeveloperControlledWalletsClient;
}

// @circle-fin/x402-batching ships its own types (v3+) — the ambient
// declaration that previously stubbed /client was removed so the real
// GatewayClient API (getBalances, decimal-string deposit/withdraw, arc
// mainnet SupportedChainName) is used.

declare module "@lifi/sdk" {
  export class LiFi {
    constructor(config: any);
    getRoutes(params: any): Promise<{ routes: any[] }>;
    executeRoute(params: any, ...args: any[]): Promise<any>;
    getQuote(params: any): Promise<any>;
    getStatus(params: any): Promise<any>;
    getChains(): Promise<any[]>;
    getTokens(params?: any): Promise<any>;
    getTokenBalances(params: any, ...args: any[]): Promise<any>;
    getApprovalData(params: any, ...args: any[]): Promise<any>;
    getToken(params: any): Promise<any>;
  }
  export type RouteOptions = any;
  export type StatusResponse = any;
  export type SwitchChainHookData = any;
  export type ConfigUpdate = any;
}

declare module "@cloak.dev/sdk" {
  export const CLOAK_PROGRAM_ID: any;
  export const createUtxo: any;
  export const createZeroUtxo: any;
  export const fullWithdraw: any;
  export const generateUtxoKeypair: any;
  export const getNkFromUtxoPrivateKey: any;
  export const partialWithdraw: any;
  export const scanTransactions: any;
  export const toComplianceReport: any;
  export const transact: any;
}

declare module "@bonfida/spl-name-service" {
  export function getDomainKey(domain: string): Promise<{ pubkey: any }>;
  export function getDomainKeySync(domain: string): { pubkey: any };
  export function getNameOwner(connection: any, domainKey: any): Promise<any>;
  export function performReverseLookup(connection: any, domainKey: any): Promise<string>;
  export function getHashedName(name: string): Promise<Buffer>;
  export function getNameAccountKey(hashedName: Buffer, parentKey?: any): Promise<any>;
  export class NameRegistryState {
    static retrieve(connection: any, nameAccountKey: any): Promise<any>;
  }
  export function getDomainKeysWithReverses(connection: any, owner: any): Promise<any[]>;
  export function getAllDomains(connection: any, owner: any): Promise<any[]>;
}

declare module "@coral-xyz/anchor" {
  export class Program<T = any> {
    constructor(idl: any, programId: any, provider?: any);
    account: any;
    methods: any;
    provider: any;
    idl: any;
    programId: any;
  }
  export class BN {
    constructor(value: number | string | number[], base?: number);
    toString(base?: number): string;
    toNumber(): number;
  }
  export interface Idl {
    [key: string]: any;
  }
  export type Provider = any;
  export const workspace: any;
  export const AnchorProvider: any;
  export const setProvider: (provider: any) => void;
  export const web3: any;
  export const utils: any;
}

declare module "@bagsfm/bags-sdk" {
  export class BagsClient {
    constructor(config: { rpcUrl: string; programId: string });
    getUserScore(address: string): Promise<number>;
    getUserReputation(address: string): Promise<number>;
  }
  export class BagsSDK {
    constructor(apiKey: string, connection?: any, ...args: any[]);
    client: BagsClient;
  }
  export const BagsSDKClient: any;
}

declare module "firebase/firestore" {
  export type DocumentData = any;
  export const collection: any;
  export const query: any;
  export const where: any;
  export const getDocs: any;
  export const orderBy: any;
  export const doc: any;
  export const getDoc: any;
  export const setDoc: any;
  export const deleteDoc: any;
  export const addDoc: any;
  export const updateDoc: any;
  export const onSnapshot: any;
  export const limit: any;
  export const increment: any;
  export const arrayUnion: any;
  export const arrayRemove: any;
  export const Timestamp: any;
  export const FieldValue: any;
  export const writeBatch: any;
  export const runTransaction: any;
  export const serverTimestamp: any;
  export const startAfter: any;
  export const endBefore: any;
}

declare module "firebase/auth" {
  export const onAuthStateChanged: any;
  export const signInWithPopup: any;
  export const signInAnonymously: any;
  export const GithubAuthProvider: any;
  export const signOut: any;
  export interface User extends Record<string, any> {}
  export const getAuth: any;
  export const connectAuthEmulator: any;
  export const signInWithCredential: any;
  export const GoogleAuthProvider: any;
  export const signInWithEmailAndPassword: any;
  export const createUserWithEmailAndPassword: any;
  export const sendPasswordResetEmail: any;
}

interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    isConnected?: () => boolean;
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on?: (event: string, handler: (...args: any[]) => void) => void;
    removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  };
}
