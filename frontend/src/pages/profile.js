import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useUser } from '@/stores/authStore';
import { useNanopayment, useWallet } from '@/stores/walletStore';
import UserProfile from '@/components/Auth/UserProfile';
import DeveloperApiKeys from '@/components/Auth/DeveloperApiKeys';
import TransactionFeed from '@/components/common/TransactionFeed';
import BuilderXpCard from '@/components/gamification/BuilderXpCard';
import useBuilderXp from '@/hooks/useBuilderXp';
import { ChartBarIcon, MagnifyingGlassIcon, BanknotesIcon, CubeIcon } from '@heroicons/react/24/outline';
import { agentsHref } from '@/config/navigation';
import { SkeletonBlock, SkeletonCard, SkeletonText } from '@/components/common/LoadingStates';

export default function ProfilePage() {
  const { currentUser, loading, userRole } = useUser();
  const { isInitialized, balance, transactions } = useNanopayment();
  const wallet = useWallet();
  const router = useRouter();
  const [myProjects, setMyProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const isBacker = userRole === 'backer';

  // Builder XP — fetch from portfolio API for hackathon proof + activity data
  const githubUsername = currentUser?.reloadUserInfo?.screenName
    || currentUser?.providerData?.find((p) => p.providerId === 'github.com')?.displayName?.toLowerCase().replace(/\s/g, '')
    || currentUser?.uid;
  const { xp: builderXp, loading: xpLoading } = useBuilderXp(!isBacker ? githubUsername : null);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login?redirect=/profile');
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    if (!currentUser || isBacker) return;
    let cancelled = false;
    async function fetchMyProjects() {
      setLoadingProjects(true);
      try {
        const { db } = await import('@/lib/firebase/clientApp');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'projects'), where('owners', 'array-contains', currentUser.uid));
        const snap = await getDocs(q);
        if (!cancelled) {
          setMyProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (e) {
        console.warn('Failed to load projects:', e);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }
    fetchMyProjects();
    return () => { cancelled = true; };
  }, [currentUser, isBacker]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <SkeletonBlock className="h-10 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-64" />
          </div>
          <div className="space-y-6">
            <SkeletonCard className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const totalSpent = transactions.reduce(
    (sum, tx) => sum + parseFloat(tx.amount || 0),
    0
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-primary mb-6">
        {isBacker ? 'Your Portfolio' : 'Your Profile'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: profile + stats */}
        <div className="lg:col-span-2 space-y-6">
          <UserProfile />

          {!isBacker && <DeveloperApiKeys />}

          {/* My Projects - Builders only */}
          {!isBacker && (
            <div className="bg-surface rounded-xl border border-default p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-primary">
                  📦 My Projects
                </h2>
                <Link href="/build" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                  + New Project
                </Link>
              </div>
              {loadingProjects ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : myProjects.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-secondary mb-3">You haven&apos;t submitted any projects yet.</p>
                  <Link href="/build" className="inline-block px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700">
                    Submit Your First Project
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myProjects.map((p) => (
                    <Link key={p.id} href={`/projects/${p.ecosystem}/${p.slug || p.id}`} className="block p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-primary text-sm">{p.name}</p>
                          <p className="text-xs text-secondary">{p.ecosystem} · {p.category}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {p.status || 'pending'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Backer Quick Actions */}
          {isBacker && (
            <div className="bg-surface rounded-xl border border-default p-6">
              <h2 className="text-sm font-semibold text-primary mb-4">
                📊 Quick Actions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link href="/explore" className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                  <MagnifyingGlassIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-primary">Explore Builders</p>
                    <p className="text-xs text-secondary mt-0.5">Find projects to back</p>
                  </div>
                </Link>
                <Link href={agentsHref('analyze')} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors">
                  <ChartBarIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-primary">AI Analysis</p>
                    <p className="text-xs text-secondary mt-0.5">Evaluate projects with AI</p>
                  </div>
                </Link>
                <Link href="/back?tab=discover" className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition-colors">
                  <BanknotesIcon className="w-5 h-5 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-primary">Bridge Loans</p>
                    <p className="text-xs text-secondary mt-0.5">Fund builders' unpaid prizes with USDC</p>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* Nanopayment Stats */}
          {isInitialized && (
            <div className="bg-surface rounded-xl border border-default p-6">
              <h2 className="text-sm font-semibold text-primary mb-4">
                ⚡ AI Agent Activity
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-600">
                    ${parseFloat(balance?.available || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-secondary mt-1">
                    Available Balance
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {transactions.length}
                  </p>
                  <p className="text-xs text-secondary mt-1">
                    {isBacker ? 'Projects Analyzed' : 'Total Queries'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    ${totalSpent.toFixed(3)}
                  </p>
                  <p className="text-xs text-secondary mt-1">
                    Total Spent
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Circle Wallet */}
          {(wallet.account || wallet.solanaAddress) && (
            <div className="bg-surface rounded-xl border border-default p-6">
              <h2 className="text-sm font-semibold text-primary mb-4">
                🔐 Wallet
              </h2>
              <div className="space-y-3">
                {wallet.solanaAddress && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-secondary">Solana</p>
                      <p className="text-sm font-mono text-primary">
                        {wallet.solanaAddress.slice(0, 6)}...{wallet.solanaAddress.slice(-4)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
                      Connected
                    </span>
                  </div>
                )}
                {wallet.account && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-secondary">EVM</p>
                      <p className="text-sm font-mono text-primary">
                        {wallet.account.slice(0, 6)}...{wallet.account.slice(-4)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800">
                      Connected
                    </span>
                  </div>
                )}
                {wallet.circleWallets && wallet.circleWallets.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs font-medium text-secondary mb-2">Circle Wallets</p>
                    {wallet.circleWallets.map((cw, i) => (
                      <div key={cw.id || i} className="flex items-center justify-between py-1">
                        <p className="text-sm font-mono text-primary">
                          {cw.address ? `${cw.address.slice(0, 6)}...${cw.address.slice(-4)}` : `Wallet ${i + 1}`}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {cw.blockchain || "EVM"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column: XP card + transaction feed */}
        <div className="space-y-6">
          {!isBacker && (builderXp || xpLoading) && (
            xpLoading ? (
              <SkeletonCard className="h-64" />
            ) : (
              <BuilderXpCard xp={builderXp} username={githubUsername} />
            )
          )}
          <TransactionFeed maxItems={10} />
        </div>
      </div>
    </div>
  );
}
