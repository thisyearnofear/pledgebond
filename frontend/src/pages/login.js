import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useUser } from "@/stores/authStore";
import { useWallet } from "@/stores/walletStore";
import { useSignMessage } from "wagmi";
import Head from "next/head";
import SnsIdentityBadge from "@/components/common/SnsIdentityBadge";
import SetupChecklist from "@/components/common/SetupChecklist";
import useLoginSetupProgress from "@/hooks/useLoginSetupProgress";
import { useApp } from "@/stores/profileStore";
import { getPostLoginDestination } from "@/lib/onboarding/loginSteps";
import { snsService } from "@/services/SnsService";
import { trackFunnelStep } from "@/lib/funnel";

/**
 * StepShell — one ceremony step. Completed steps collapse to a one-line
 * confirmation; only the active step expands. Beginners keep helper copy
 * (showHints); experienced users get the terse line.
 */
function StepShell({ done, title, doneLine, hint, children }) {
  if (done) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-green-500/60 bg-green-50 dark:bg-green-900/20">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-primary">{title}</p>
          <p className="truncate text-xs text-green-800 dark:text-green-300">{doneLine}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border-2 transition-all border-gray-200 dark:border-gray-700">
      {children}
      {hint && <p className="px-4 pb-3 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

export default function LoginPage() {
  const { currentUser, signInWithGithub, signInWithWallet, linkWallet, linkedWallets, userRole, logout } = useUser();
  const {
    connected: evmConnected,
    address: evmAddress,
    connect: connectEvm,
    connecting: evmConnecting,
    disconnect: disconnectEvm,
    solanaConnected,
    solanaAddress,
    connectSolana,
    solanaConnecting,
    solanaWallet,
    disconnectSolana,
  } = useWallet();
  const { signMessageAsync } = useSignMessage();

  const router = useRouter();
  const { redirect } = router.query;

  const [error, setError] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [walletFamily, setWalletFamily] = useState(null);
  const [role, setRole] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [connectedSnsName, setConnectedSnsName] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  const anyWalletConnected = evmConnected || solanaConnected;
  const activeWalletAddress = walletFamily === 'solana' ? solanaAddress : evmAddress;
  const alreadyLinked = activeWalletAddress && linkedWallets.some(w => w.address.toLowerCase() === activeWalletAddress.toLowerCase());
  const isFullyAuthed = !!currentUser && anyWalletConnected && linked;

  const { steps: setupSteps, progress: setupProgress } = useLoginSetupProgress({
    role,
    currentUser,
    anyWalletConnected,
    linked,
    alreadyLinked,
  });
  // showHints → beginners keep helper copy; experienced users get terse lines.
  const { getAdaptiveSettings } = useApp();
  const showHints = getAdaptiveSettings().showHints;

  useEffect(() => {
    if (!walletFamily) {
      if (solanaConnected && solanaAddress) setWalletFamily('solana');
      else if (evmConnected && evmAddress) setWalletFamily('evm');
    }
  }, [solanaConnected, solanaAddress, evmConnected, evmAddress, walletFamily]);

  useEffect(() => {
    if (alreadyLinked && currentUser && !linked) setLinked(true);
  }, [alreadyLinked, currentUser, linked]);

  useEffect(() => {
    if (walletFamily === 'solana' && solanaAddress) {
      snsService.resolveAddressToName(solanaAddress).then(setConnectedSnsName).catch(() => {});
    } else {
      setConnectedSnsName(null);
    }
  }, [walletFamily, solanaAddress]);

  useEffect(() => {
    if (userRole && !role) setRole(userRole);
  }, [userRole, role]);

  // On revisit: if Firebase auth persists, skip the full login flow.
  // Redirect immediately if we have wallet-linked data from Firestore,
  // even without a fresh wallet connection.
  // GitHub-only builders: redirect into the hub with a banner reminding
  // them to link a wallet before requesting funding.
  useEffect(() => {
    if (isFullyAuthed || (alreadyLinked && currentUser)) {
      const dest = getPostLoginDestination(role || userRole || "builder", redirect);
      const timer = setTimeout(() => router.push(dest), 1500);
      return () => clearTimeout(timer);
    }
    if (currentUser && linkedWallets.length > 0 && !role) {
      setRole("builder");
    }
    if (currentUser && linkedWallets.length > 0 && role) {
      const dest = getPostLoginDestination(role, redirect);
      const timer = setTimeout(() => router.push(dest), 500);
      return () => clearTimeout(timer);
    }
    // GitHub-only + role chosen (or defaulting builder) → land in the hub.
    // Wallet linking is deferred to the first payout-bearing action.
    if (
      currentUser &&
      linkedWallets.length === 0 &&
      !anyWalletConnected &&
      !isFullyAuthed
    ) {
      const resolvedRole = role || userRole || "builder";
      if (resolvedRole) {
        const dest = getPostLoginDestination(resolvedRole, redirect);
        const timer = setTimeout(() => router.push(dest), 800);
        return () => clearTimeout(timer);
      }
    }
  }, [isFullyAuthed, alreadyLinked, currentUser, linkedWallets, redirect, router, role, userRole, anyWalletConnected]);

  const signWalletMessage = useCallback(async () => {
    if (!anyWalletConnected || !activeWalletAddress) throw new Error('No wallet connected');
    const identifier = currentUser?.providerData?.find(p => p.providerId === 'github.com')?.uid
      || currentUser?.displayName || activeWalletAddress;
    // SIWE-style fields: nonce (replay protection), domain (prevents
    // cross-site replay), ISO timestamp (human-readable audit trail).
    // Chain family is the only chain identifier included — EVM chainId is
    // intentionally not bound into the message because sign-in is a
    // wallet-ownership proof, not a chain-scoped auth.
    const nonce = typeof crypto !== 'undefined' && /** @type {any} */ (crypto).randomUUID
      ? /** @type {any} */ (crypto).randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const domain = typeof window !== 'undefined' ? window.location.host : 'pledgebond.com';
    const timestamp = new Date().toISOString();
    const message = [
      'PledgeBond - Verify Identity',
      '',
      `Identifier: ${identifier}`,
      `Wallet: ${activeWalletAddress}`,
      `Chain: ${walletFamily || 'unknown'}`,
      `Domain: ${domain}`,
      `Nonce: ${nonce}`,
      `Timestamp: ${timestamp}`,
    ].join('\n');
    let signature;
    if (walletFamily === 'solana') {
      if (!solanaWallet?.signMessage) throw new Error('Your Solana wallet does not support message signing');
      const encoded = new TextEncoder().encode(message);
      const sigBytes = await solanaWallet.signMessage(encoded);
      signature = Buffer.from(sigBytes).toString('base64');
    } else {
      signature = await signMessageAsync({ message });
    }
    return { signature, message };
  }, [anyWalletConnected, activeWalletAddress, currentUser, walletFamily, solanaWallet, signMessageAsync]);

  const handleStartOver = async () => {
    try {
      if (solanaConnected) await disconnectSolana();
      if (evmConnected) disconnectEvm();
    } catch (_) { /* ignore */ }
    if (currentUser) await logout();
    setRole(null);
    setLinked(false);
    setError(null);
    setConnectedSnsName(null);
  };

  const handleConnectEvm = () => {
    setError(null);
    trackFunnelStep("login", "wallet_connect_clicked", { role });
    connectEvm();
    setWalletFamily('evm');
  };

  const handleConnectSolana = async () => {
    try { setError(null); trackFunnelStep("login", "wallet_connect_clicked", { role }); await connectSolana(); setWalletFamily('solana'); }
    catch { setError("Could not open the Solana wallet picker. Try refreshing the page."); }
  };

  const handleGithubLogin = async () => {
    try { setError(null); setIsSigningIn(true); trackFunnelStep("login", "github_connect_clicked", { role }); await signInWithGithub(); }
    catch { setError("GitHub sign-in was cancelled or failed."); }
    finally { setIsSigningIn(false); }
  };

  const handleLinkIdentity = async () => {
    if (!currentUser || !anyWalletConnected || !activeWalletAddress) return;
    try { setError(null); setIsLinking(true); const { signature, message } = await signWalletMessage(); await linkWallet(activeWalletAddress, signature, message, walletFamily); trackFunnelStep("login", "identity_signed", { role, flow: "link" }); setLinked(true); }
    catch (err) { setError(err.message || "Wallet verification failed. Try again."); }
    finally { setIsLinking(false); }
  };

  const handleWalletSignIn = async () => {
    if (!anyWalletConnected || !activeWalletAddress) return;
    try { setError(null); setIsLinking(true); const { signature, message } = await signWalletMessage(); await signInWithWallet(activeWalletAddress, signature, message, walletFamily); trackFunnelStep("login", "identity_signed", { role, flow: "wallet_signin" }); setLinked(true); }
    catch (err) { setError(err.message || "Wallet verification failed. Try again."); }
    finally { setIsLinking(false); }
  };

  const renderWalletButtons = () => {
    if (!mounted) return <div className="text-sm text-gray-400 dark:text-gray-500">Loading wallets...</div>;
    return (
      <div className="flex flex-col items-stretch gap-2 w-full sm:w-auto sm:min-w-[260px]">
        <div className="flex gap-2">
          <button
            onClick={handleConnectEvm}
            disabled={evmConnecting}
            title="MetaMask, Rabby, Coinbase Wallet, WalletConnect, and more"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-all"
          >
            {evmConnecting ? <span className="animate-spin">{'⏳'}</span> : <>{'\u{1F98A}'} EVM Wallet</>}
          </button>
          <button
            onClick={handleConnectSolana}
            disabled={solanaConnecting}
            title="Phantom, Solflare, Backpack, etc."
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all"
          >
            {solanaConnecting ? <span className="animate-spin">{'⏳'}</span> : <>{'\u{1F47B}'} Solana Wallet</>}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center leading-snug">
          EVM supports MetaMask, Rabby, Coinbase, WalletConnect &amp; more.
        </p>
      </div>
    );
  };

  if (!role) {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-background">
        <Head><title>Sign In - PledgeBond</title></Head>
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <img className="mx-auto h-16 w-16 rounded shadow-lg" src="/pledgebond.png" alt="PledgeBond" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-primary">Welcome to PledgeBond</h2>
          <p className="mt-2 text-center text-sm text-secondary">Choose how you want to participate.</p>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
          <SetupChecklist steps={setupSteps} />
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { trackFunnelStep("login", "role_selected", { role: "builder" }); setRole('builder'); }}
              className="p-6 bg-surface rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
              <div className="text-2xl mb-2">{'\u{1F680}'}</div>
              <h3 className="text-lg font-bold text-primary group-hover:text-blue-700 dark:text-blue-300">I&apos;m Building</h3>
              <p className="text-sm text-secondary mt-1">Ship projects and get funded based on your track record.</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Connects GitHub + Wallet</p>
            </button>
            <button onClick={() => { trackFunnelStep("login", "role_selected", { role: "backer" }); setRole('backer'); }}
              className="p-6 bg-surface rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all text-left group">
              <div className="text-2xl mb-2">{'\u{1F4B0}'}</div>
              <h3 className="text-lg font-bold text-primary group-hover:text-purple-700 dark:text-purple-300">I&apos;m Backing</h3>
              <p className="text-sm text-secondary mt-1">Fund builders and track your portfolio.</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Wallet only — no GitHub needed</p>
            </button>
          </div>
          <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">You can always add more later in your profile.</p>
        </div>
      </div>
    );
  }

  if (role === 'backer') {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-background">
        <Head><title>Sign In - PledgeBond</title></Head>
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <img className="mx-auto h-16 w-16 rounded shadow-lg" src="/pledgebond.png" alt="PledgeBond" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-primary">Connect Your Wallet</h2>
          <p className="mt-2 text-center text-sm text-secondary">This is your identity on PledgeBond. You&apos;ll sign a message to prove you own it.</p>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
          <SetupChecklist steps={setupSteps} />
          <p className="text-center text-xs text-secondary mb-4">Step {setupProgress.label}</p>
          <div className="bg-surface py-8 px-4 shadow-xl border border-gray-100 sm:rounded-xl sm:px-10">
            {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}
            <div className="space-y-4">
              {/* Step 1 collapses once connected — no reason to re-read it. */}
              <StepShell
                done={anyWalletConnected}
                title="Wallet"
                doneLine={activeWalletAddress ? `${connectedSnsName || `${activeWalletAddress.slice(0,6)}...${activeWalletAddress.slice(-4)}`} connected` : "Wallet connected"}
                hint={showHints ? "Where you receive funds." : null}
              >
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center">
                    <div className="p-2 rounded-full bg-gray-100 text-gray-400 dark:text-gray-500">
                      <span className="text-xs font-bold">1</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-bold text-primary">Your Wallet</p>
                      <p className="text-xs text-secondary">Where you receive funds</p>
                    </div>
                  </div>
                  {renderWalletButtons()}
                </div>
              </StepShell>

              <div className={`p-6 rounded-lg border-2 border-dashed transition-all text-center ${isFullyAuthed ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                {isFullyAuthed ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-green-700 dark:text-green-300">You&apos;re in!</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Taking you to your dashboard...</p>
                  </div>
                ) : alreadyLinked ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-green-700 dark:text-green-300">This wallet is already linked to your account.</p>
                    <Link href="/profile" className="text-xs text-blue-600 dark:text-blue-400 underline">Manage your wallets</Link>
                  </div>
                ) : anyWalletConnected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-secondary">Your wallet is connected. Sign in:</p>
                    <button onClick={handleWalletSignIn} disabled={isLinking}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg shadow-md hover:from-purple-700 hover:to-blue-700 disabled:opacity-30 disabled:grayscale transition-all">
                      {isLinking ? 'Waiting for wallet...' : 'Sign In with Wallet'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-secondary">Connect a wallet above to sign in.</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => setRole(null)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300">{'←'} Back</button>
                <button onClick={handleStartOver} className="text-sm text-red-400 hover:text-red-600 dark:text-red-400">Start over</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-background">
      <Head><title>Sign In - PledgeBond</title></Head>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img className="mx-auto h-16 w-16 rounded shadow-lg" src="/pledgebond.png" alt="PledgeBond" />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-primary">Set Up Your Builder Profile</h2>
        <p className="mt-2 text-center text-sm text-secondary">Two quick steps to verify your identity and start shipping.</p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <SetupChecklist steps={setupSteps} />
        <p className="text-center text-xs text-secondary mb-4">Step {setupProgress.label}</p>
        <div className="bg-surface py-8 px-4 shadow-xl border border-gray-100 sm:rounded-xl sm:px-10">
          {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}
          <div className="space-y-6">
            <div className="space-y-4">
              <StepShell
                done={!!currentUser}
                title="GitHub"
                doneLine={currentUser?.displayName ? `Signed in as ${currentUser.displayName}` : "GitHub connected"}
                hint={showHints ? "We read your public repos to verify your shipping history." : null}
              >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 rounded-full bg-gray-100 text-gray-400 dark:text-gray-500">
                      <span className="text-xs font-bold">1</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-bold text-primary">GitHub</p>
                      <p className="text-xs text-secondary">Verify your shipping history.</p>
                    </div>
                  </div>
                  <button onClick={handleGithubLogin} disabled={isSigningIn}
                    className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-md hover:bg-gray-800 disabled:opacity-50">
                    {isSigningIn ? 'Opening GitHub...' : 'Connect GitHub'}
                  </button>
                </div>
              </div>
              </StepShell>

            <StepShell
              done={anyWalletConnected}
              title="Wallet"
              doneLine={activeWalletAddress ? `${connectedSnsName || `${activeWalletAddress.slice(0,6)}...${activeWalletAddress.slice(-4)}`} connected` : "Wallet connected"}
              hint={showHints ? "Where you receive funding payouts." : null}
            >
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center">
                    <div className="p-2 rounded-full bg-gray-100 text-gray-400 dark:text-gray-500">
                      <span className="text-xs font-bold">2</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-bold text-primary">Wallet</p>
                      <p className="text-xs text-secondary">Where you receive funding payouts.</p>
                    </div>
                  </div>
                  {renderWalletButtons()}
                </div>
              </div>
            </StepShell>

            <div className={`p-6 rounded-lg border-2 border-dashed transition-all text-center ${isFullyAuthed || alreadyLinked ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
              {isFullyAuthed ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-green-700 dark:text-green-300">All set!</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Taking you to your dashboard...</p>
                </div>
              ) : alreadyLinked ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-green-700 dark:text-green-300">This wallet is already linked to your account.</p>
                  <Link href="/profile" className="text-xs text-blue-600 dark:text-blue-400 underline">Manage your wallets</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-secondary">Sign a message to confirm your wallet. Nothing is sent on-chain — this just proves you own it.</p>
                  <button onClick={handleLinkIdentity} disabled={!currentUser || !anyWalletConnected || isLinking}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg shadow-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-30 disabled:grayscale transition-all">
                    {isLinking ? 'Waiting for wallet...' : 'Confirm & Continue'}
                  </button>
                  {!currentUser && <p className="text-xs text-gray-400 dark:text-gray-500">Connect GitHub first (step 1)</p>}
                  {currentUser && !anyWalletConnected && <p className="text-xs text-gray-400 dark:text-gray-500">Connect a wallet (step 2)</p>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setRole(null)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300">{'←'} Back</button>
              <button onClick={handleStartOver} className="text-sm text-red-400 hover:text-red-600 dark:text-red-400">Start over</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
