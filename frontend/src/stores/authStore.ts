/**
 * useAuthStore — Firebase auth, wallet linking, role, profile, credit data.
 *
 * Replaces the auth/reputation portion of the old UserContext.tsx.
 * Project authorization is derived from canonical `projects.owners` records
 * and enforced by server APIs; it is intentionally not cached on user docs.
 */

import {
  onAuthStateChanged,
  signInWithPopup,
  signInAnonymously,
  GithubAuthProvider,
  signOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase/clientApp";
import { createStore, useStore, type Store } from "./createStore";
import { profileActions } from "./profileStore";

// ============================================================================
// Types
// ============================================================================

export interface LinkedWallet {
  address: string;
  chainFamily: "evm" | "solana";
  signature: string;
  message: string;
  linkedAt: string;
}

export interface UserProfile {
  address?: string;
  profiles?: { github?: any; farcaster?: any; lens?: any };
  creditData?: any;
  completionStatus?: Record<string, boolean>;
  lastUpdated?: string;
}

// ============================================================================
// Store
// ============================================================================

interface AuthState {
  // Firebase Auth
  currentUser: User | null;
  loading: boolean;
  // Role
  userRole: "builder" | "backer" | null;
  // Decentralized Identity / Reputation
  userProfile: UserProfile | null;
  creditData: any | null;
  onboardingComplete: boolean;
  // Wallet Linking
  linkedWallets: LinkedWallet[];
}

const initialState: AuthState = {
  currentUser: null,
  loading: true,
  userRole: null,
  userProfile: null,
  creditData: null,
  onboardingComplete: false,
  linkedWallets: [],
};

export const authStore: Store<AuthState> = createStore<AuthState>(initialState);

// ============================================================================
// Actions (live on the store's getState())
// ============================================================================

async function loadUserProfile(user: User) {
  const userDocRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userDocRef);
  if (!userDoc.exists()) {
    authStore.setState({ userRole: null, linkedWallets: [] });
    return;
  }
  const data = userDoc.data();
  const wallets: LinkedWallet[] = Array.isArray(data.wallets) ? data.wallets : (data.walletAddress ? [{
    address: data.walletAddress,
    chainFamily: data.chainFamily || "evm",
    signature: data.walletSignature || "",
    message: data.walletMessage || "",
    linkedAt: data.linkedAt || new Date().toISOString(),
  }] : []);
  authStore.setState({
    userRole: data.userRole || (data.githubUsername ? "builder" : null),
    linkedWallets: wallets,
  });
}

function attachAuthListener() {
  return onAuthStateChanged(auth, async (user: User | null) => {
    authStore.setState({ currentUser: user, loading: true });
    if (user) {
      await loadUserProfile(user);
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        authStore.setState({
          userProfile: data.profile || null,
          creditData: data.creditData || null,
          onboardingComplete: data.onboardingComplete || false,
        });
      } else {
        // New user — check for stored referral code and attribute
        try {
          const {
            getStoredReferralCode,
            clearStoredReferralCode,
            getStoredShareAttribution,
            clearStoredShareAttribution,
            REFERRAL_BONUS_XP,
          } = await import("@/lib/gamification/referral");
          const refCode = getStoredReferralCode();
          const shareAttr = getStoredShareAttribution();
          if (refCode || shareAttr) {
            await setDoc(doc(db, "referrals", user.uid), {
              referralCode: refCode || shareAttr?.code,
              referredUid: user.uid,
              referredAt: new Date().toISOString(),
              bonusXp: REFERRAL_BONUS_XP,
              status: "pending",
              // Leaderboard-share attribution — which copy variant and which
              // entry drove this signup, for the share funnel worksheet.
              ...(shareAttr
                ? {
                    source: "leaderboard_share",
                    shareCode: shareAttr.code,
                    shareVariant: shareAttr.variant ?? null,
                    shareRef: shareAttr.ref ?? null,
                  }
                : {}),
            }, { merge: true });
            clearStoredReferralCode();
            clearStoredShareAttribution();
          }
        } catch { /* non-fatal */ }
      }
    } else {
      authStore.setState({
        userProfile: null,
        creditData: null,
        onboardingComplete: false,
      });
    }
    authStore.setState({ loading: false });
  });
}

// ============================================================================
// Public actions (attached to the store value)
// ============================================================================

async function signInWithGithub() {
  const provider = new GithubAuthProvider();
  await signInWithPopup(auth, provider);
}

async function signInWithWallet(
  walletAddress: string,
  signature: string,
  message: string,
  chainFamily: "evm" | "solana" = "evm",
) {
  // 1. Anonymous Firebase sign-in (or merge with current anonymous user)
  const cred = await signInAnonymously(auth);
  const uid = cred.user.uid;

  // 2. Write to users/{uid} and wallet_index/{addrLower}
  const walletKey = walletAddress.toLowerCase();
  await Promise.all([
    setDoc(doc(db, "users", uid), {
      walletAddress,
      chainFamily,
      wallets: [{ address: walletAddress, chainFamily, signature, message, linkedAt: new Date().toISOString() }],
      linkedAt: new Date().toISOString(),
    }, { merge: true }),
    setDoc(doc(db, "wallet_index", walletKey), { uid, walletAddress, chainFamily }, { merge: true }),
  ]);
}

async function linkWallet(
  walletAddress: string,
  signature: string,
  message: string,
  chainFamily: "evm" | "solana" = "evm",
) {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  // Validate ownership of the wallet_index entry
  const walletKey = walletAddress.toLowerCase();
  const idxDoc = await getDoc(doc(db, "wallet_index", walletKey));
  if (!idxDoc.exists() || idxDoc.data().uid !== user.uid) {
    throw new Error("Wallet ownership not verified");
  }
  const linkedWallet: LinkedWallet = {
    address: walletAddress,
    chainFamily,
    signature,
    message,
    linkedAt: new Date().toISOString(),
  };
  const userDocRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userDocRef);
  const existing: LinkedWallet[] = userDoc.exists() ? (userDoc.data().wallets || []) : [];
  const updated = [...existing.filter((w) => w.address.toLowerCase() !== walletKey), linkedWallet];
  await setDoc(userDocRef, { wallets: updated, walletAddress, linkedAt: linkedWallet.linkedAt }, { merge: true });
  authStore.setState({ linkedWallets: updated });
}

async function unlinkWallet(walletAddress: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  const walletKey = walletAddress.toLowerCase();
  const userDocRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userDocRef);
  const existing: LinkedWallet[] = userDoc.exists() ? (userDoc.data().wallets || []) : [];
  const updated = existing.filter((w) => w.address.toLowerCase() !== walletKey);
  await Promise.all([
    setDoc(userDocRef, { wallets: updated, walletAddress: updated[0]?.address || null }, { merge: true }),
    setDoc(doc(db, "wallet_index", walletKey), { uid: null }, { merge: true }),
  ]);
  authStore.setState({ linkedWallets: updated });
}

async function logout() {
  await signOut(auth);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("pos_user_profile");
  }
  authStore.setState({
    userProfile: null,
    creditData: null,
    onboardingComplete: false,
    linkedWallets: [],
    userRole: null,
  });
}

async function completeOnboarding(profile: UserProfile, creditData: any) {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  authStore.setState({ userProfile: profile, creditData, onboardingComplete: true });
  await setDoc(doc(db, "users", user.uid), {
    profile,
    creditData,
    onboardingComplete: true,
  }, { merge: true });
}

async function updateProfile(updates: Partial<UserProfile>) {
  const { userProfile, creditData } = authStore.getState();
  const next: UserProfile = { ...(userProfile || {}), ...updates };
  authStore.setState({ userProfile: next });
  if (updates.profiles) {
    // Profile data changed; let the profile store recompute derived values
    profileActions.refreshDerived(next, creditData);
  }
  const user = auth.currentUser;
  if (user) {
    await setDoc(doc(db, "users", user.uid), { profile: next }, { merge: true });
  }
  return next;
}

async function refreshProfile() {
  const user = auth.currentUser;
  if (!user) return;
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (!userDoc.exists()) return;
  const data = userDoc.data();
  authStore.setState({
    userProfile: data.profile || null,
    creditData: data.creditData || null,
    onboardingComplete: data.onboardingComplete || false,
  });
}

function clearProfile() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("pos_user_profile");
    try {
      const req = indexedDB.deleteDatabase("PledgeBondDB");
      req.onsuccess = () => {};
      req.onerror = () => {};
    } catch {}
  }
  authStore.setState({ userProfile: null, creditData: null, onboardingComplete: false });
}

function isAuthenticated(s: AuthState) {
  return !!s.currentUser;
}

function completionPercentage(s: AuthState) {
  const status = s.userProfile?.completionStatus;
  if (!status) return 0;
  const keys = Object.keys(status);
  if (keys.length === 0) return 0;
  return Math.round((keys.filter((k) => status[k]).length / keys.length) * 100);
}

function isProfileComplete(s: AuthState) {
  return completionPercentage(s) === 100;
}

function hasMinimumProfile(s: AuthState) {
  const status = s.userProfile?.completionStatus;
  return !!(status?.wallet && status?.github);
}

function getRecommendations(s: AuthState) {
  return s.creditData?.recommendations || [];
}

// ============================================================================
// Initialization (called once from AppProviders on mount)
// ============================================================================

let initialized = false;
export function initAuthStore() {
  if (initialized) return;
  initialized = true;
  attachAuthListener();
}

// ============================================================================
// Hooks
// ============================================================================

export const useAuthStore = <T,>(selector: (s: AuthState) => T) => useStore(authStore, selector);

// Convenience: actions live on the store value so consumers can call
// `authStore.getState().signInWithGithub()` or destructure them in components.
export const authActions = {
  signInWithGithub,
  signInWithWallet,
  linkWallet,
  unlinkWallet,
  logout,
  completeOnboarding,
  updateProfile,
  refreshProfile,
  clearProfile,
  isAuthenticated,
  completionPercentage,
  isProfileComplete,
  hasMinimumProfile,
  getRecommendations,
};

// ============================================================================
// Convenience hook — drop-in replacement for the old `useUser()` context.
// Returns the combined state + actions that UserContext.tsx exposed.
// ============================================================================

export function useUser() {
  const currentUser = useStore(authStore, (s) => s.currentUser);
  const loading = useStore(authStore, (s) => s.loading);
  const userRole = useStore(authStore, (s) => s.userRole);
  const userProfile = useStore(authStore, (s) => s.userProfile);
  const creditData = useStore(authStore, (s) => s.creditData);
  const onboardingComplete = useStore(authStore, (s) => s.onboardingComplete);
  const linkedWallets = useStore(authStore, (s) => s.linkedWallets);

  return {
    currentUser,
    loading,
    userRole,
    userProfile,
    creditData,
    onboardingComplete,
    linkedWallets,
    isAuthReady: !loading,
    signInWithGithub,
    signInWithWallet,
    linkWallet,
    unlinkWallet,
    logout,
    completeOnboarding,
    updateProfile,
    refreshProfile,
    clearProfile,
    isAuthenticated: () => isAuthenticated({ currentUser, loading, userRole, userProfile, creditData, onboardingComplete, linkedWallets } as any),
    completionPercentage: () => completionPercentage({ currentUser, loading, userRole, userProfile, creditData, onboardingComplete, linkedWallets } as any),
    isProfileComplete: () => isProfileComplete({ currentUser, loading, userRole, userProfile, creditData, onboardingComplete, linkedWallets } as any),
    hasMinimumProfile: () => hasMinimumProfile({ currentUser, loading, userRole, userProfile, creditData, onboardingComplete, linkedWallets } as any),
    getRecommendations: () => getRecommendations({ currentUser, loading, userRole, userProfile, creditData, onboardingComplete, linkedWallets } as any),
  };
}
