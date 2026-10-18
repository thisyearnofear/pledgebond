import Link from "next/link";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import {
  Bars3Icon,
  XMarkIcon,
  CreditCardIcon,
  ChartBarIcon,
  GlobeAltIcon,
  BoltIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { useUser } from "@/stores/authStore";
import { useNanopayment, useWallet } from "@/stores/walletStore";
import { PRIMARY_NAV, filterNavItems } from "@/config/navigation";
import useLoginSetupProgress from "@/hooks/useLoginSetupProgress";
import { Fragment, useState, useEffect } from "react";
import Breadcrumbs from "../../Breadcrumbs";
import ThemeToggle from "../../ThemeToggle";
import NotificationBell from "../../NotificationBell";
import UserIdentityHeader from "./UserIdentityHeader";
import UserMenuItems from "./UserMenuItems";
import { classNames } from "@/utils/common";

const NAV_ICONS = {
  explore: GlobeAltIcon,
  leaderboard: TrophyIcon,
  build: CreditCardIcon,
  back: ChartBarIcon,
};

export default function Navbar() {
  const router = useRouter();
  const pathname = router.asPath;
  const [mounted, setMounted] = useState(false);
  const { currentUser, logout, userRole, linkedWallets, loading: authLoading } = useUser();
  const { isInitialized: nanopayReady, balance } = useNanopayment();
  const wallet = useWallet();
  const { disconnect: disconnectEvm, disconnectSolana, solanaAddress, account } = wallet;
  const githubUsername =
    currentUser?.reloadUserInfo?.screenName
    || currentUser?.providerData?.find((p) => p.providerId === "github.com")?.displayName?.toLowerCase().replace(/\s/g, "")
    || null;

  const wallets = linkedWallets.map((w) => {
    const isConnected = w.chainFamily === "solana"
      ? solanaAddress?.toLowerCase() === w.address.toLowerCase()
      : account?.toLowerCase() === w.address.toLowerCase();
    return { address: w.address, chainFamily: w.chainFamily, isConnected };
  });

  const hasAnyWallet = wallets.length > 0 || !!solanaAddress || !!account;

  useEffect(() => {
    setMounted(true);
  }, []);

  const authReady = mounted && !authLoading;
  const navigation = filterNavItems(PRIMARY_NAV, { currentUser, userRole });
  const { navbarLabel } = useLoginSetupProgress({
    currentUser,
    hasAnyWallet,
    linkedWallets,
  });
  const setupCtaLabel = navbarLabel || "Complete setup";

  const handleLogout = async () => {
    disconnectEvm();
    disconnectSolana();
    await logout();
  };

  return (
    <div>
      <Disclosure as="nav" className="bg-surface shadow-lg border-b border-default">
        {({ open }) => (
          <>
            <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-8">
              <div className="flex h-14 sm:h-16 justify-between items-center">
                <div className="flex items-center flex-shrink-0">
                  <div className="flex shrink-0 items-center">
                    <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
                      <img
                        src="/pledgebond.png"
                        alt="PledgeBond logo"
                        width={32}
                        height={32}
                        className="rounded w-8 h-8 sm:w-10 sm:h-10"
                      />
                      <div className="hidden sm:block">
                        <div className="text-base sm:text-lg font-bold text-primary">PledgeBond</div>
                      </div>
                    </Link>
                  </div>
                  <div className="hidden lg:ml-8 lg:flex lg:space-x-1">
                    {navigation.map((item) => {
                      const Icon = NAV_ICONS[item.id];
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={classNames(
                            pathname === item.href
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "text-secondary hover:text-gray-900 hover:bg-gray-50 border-transparent",
                            "group flex items-center px-3 py-2 text-sm font-medium rounded-md border transition-all duration-200",
                          )}
                          aria-current={pathname === item.href ? "page" : undefined}
                        >
                          {Icon && (
                            <Icon
                              className={classNames(
                                pathname === item.href ? "text-blue-600" : "text-muted group-hover:text-gray-600",
                                "mr-2 h-4 w-4",
                              )}
                            />
                          )}
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="hidden sm:ml-4 sm:flex sm:items-center gap-2 sm:gap-3">
                  {nanopayReady && currentUser && (
                    <Link
                      href="/back"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors text-xs"
                      title="AI agent balance"
                    >
                      <BoltIcon className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span className="font-semibold text-teal-700 dark:text-teal-300">
                        ${parseFloat(balance?.available || 0).toFixed(2)}
                      </span>
                    </Link>
                  )}

                  <ThemeToggle />

                  {currentUser && <NotificationBell />}

                  {!authReady ? (
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </div>
                  ) : currentUser ? (
                    <div className="flex items-center gap-2">
                      <Menu as="div" className="relative">
                        <Menu.Button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
                          {currentUser.photoURL ? (
                            <img className="h-7 w-7 rounded-full ring-2 ring-blue-500/30" src={currentUser.photoURL} alt="" />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-blue-500/30">
                              {userRole === "backer" ? "B" : "U"}
                            </div>
                          )}
                          <div className="hidden md:flex flex-col items-start text-left leading-tight">
                            <span className="text-xs font-semibold text-primary truncate max-w-[100px]">
                              {currentUser.displayName || "User"}
                            </span>
                            <span className={`text-[10px] font-medium ${userRole === "backer" ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"}`}>
                              {userRole === "backer" ? "Backer" : "Builder"}
                            </span>
                          </div>
                        </Menu.Button>

                        <Transition
                          as={Fragment}
                          enter="transition ease-out duration-200"
                          enterFrom="transform opacity-0 scale-95"
                          enterTo="transform opacity-100 scale-100"
                          leave="transition ease-in duration-75"
                          leaveFrom="transform opacity-100 scale-100"
                          leaveTo="transform opacity-0 scale-95"
                        >
                          <Menu.Items className="absolute right-0 z-10 mt-2 w-72 origin-top-right rounded-xl bg-surface shadow-xl ring-1 ring-black/5 focus:outline-none border border-default overflow-hidden">
                            <UserIdentityHeader
                              currentUser={currentUser}
                              userRole={userRole}
                              githubUsername={githubUsername}
                              wallets={wallets}
                            />
                            <UserMenuItems
                              userRole={userRole}
                              githubUsername={githubUsername}
                              onSignOut={handleLogout}
                            />
                          </Menu.Items>
                        </Transition>
                      </Menu>
                    </div>
                  ) : hasAnyWallet ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/login"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold hover:from-blue-700 hover:to-purple-700 transition-all min-h-touch flex items-center justify-center shadow-sm"
                      >
                        {setupCtaLabel}
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/login"
                        className="px-3 py-1.5 text-sm font-medium text-primary hover:text-gray-900 dark:hover:text-white border border-default rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/login"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold hover:from-blue-700 hover:to-purple-700 transition-all min-h-touch flex items-center justify-center shadow-sm"
                      >
                        Get Started
                      </Link>
                    </div>
                  )}
                </div>

                <div className="flex sm:hidden items-center gap-1">
                  {!authReady ? (
                    <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  ) : currentUser ? (
                    <Menu as="div" className="relative">
                      <Menu.Button className="flex items-center">
                        {currentUser.photoURL ? (
                          <img className="h-7 w-7 rounded-full ring-2 ring-blue-500/30" src={currentUser.photoURL} alt="" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-blue-500/30">
                            {userRole === "backer" ? "B" : "U"}
                          </div>
                        )}
                      </Menu.Button>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-200"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-xl bg-surface shadow-xl ring-1 ring-black/5 focus:outline-none border border-default overflow-hidden">
                          <UserIdentityHeader
                            currentUser={currentUser}
                            userRole={userRole}
                            githubUsername={githubUsername}
                            wallets={wallets}
                            compact
                            showStatus={false}
                          />
                          <UserMenuItems
                            userRole={userRole}
                            githubUsername={githubUsername}
                            onSignOut={handleLogout}
                            compact
                          />
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  ) : hasAnyWallet ? (
                    <Link
                      href="/login"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-2.5 py-1.5 rounded-md text-xs font-semibold min-h-touch flex items-center justify-center"
                    >
                      {setupCtaLabel}
                    </Link>
                  ) : (
                    <Link
                      href="/login"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-2.5 py-1.5 rounded-md text-xs font-semibold min-h-touch flex items-center justify-center"
                    >
                      Get Started
                    </Link>
                  )}
                  <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 min-w-touch min-h-touch">
                    <span className="sr-only">Open main menu</span>
                    {open ? <XMarkIcon className="block h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" /> : <Bars3Icon className="block h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />}
                  </Disclosure.Button>
                </div>
              </div>
            </div>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Disclosure.Panel className="sm:hidden bg-surface border-t border-default">
                <div className="space-y-1 px-2 py-2 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
                  {navigation.map((item) => {
                    const Icon = NAV_ICONS[item.id];
                    return (
                      <Disclosure.Button
                        key={item.id}
                        as={Link}
                        href={item.href}
                        className={classNames(
                          pathname === item.href
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800",
                          "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium min-h-touch transition-colors",
                        )}
                        aria-current={pathname === item.href ? "page" : undefined}
                      >
                        {Icon && (
                          <Icon
                            className={classNames(
                              pathname === item.href ? "text-blue-600 dark:text-blue-400" : "text-muted",
                              "mr-3 h-4 w-4 sm:h-5 sm:w-5",
                            )}
                          />
                        )}
                        <span className="flex-1">{item.label}</span>
                      </Disclosure.Button>
                    );
                  })}

                  {nanopayReady && (
                    <div className="mt-2 pt-2 border-t border-default">
                      <Link
                        href="/back"
                        className="flex items-center justify-between rounded-md px-3 py-2.5 bg-teal-50 dark:bg-teal-900/20 text-sm font-medium min-h-touch"
                      >
                        <span className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
                          <BoltIcon className="w-4 h-4" />
                          AI Agents
                        </span>
                        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                          ${parseFloat(balance?.available || 0).toFixed(2)}
                        </span>
                      </Link>
                    </div>
                  )}

                  {authReady && !currentUser && (
                    <div className="mt-4 pt-4 border-t border-default">
                      <Link
                        href="/login"
                        className="block bg-surface-tertiary text-primary px-3 py-2.5 rounded-md text-sm font-medium text-center min-h-touch"
                      >
                        {hasAnyWallet ? setupCtaLabel : "Sign in"}
                      </Link>
                    </div>
                  )}
                </div>
              </Disclosure.Panel>
            </Transition>
          </>
        )}
      </Disclosure>
      <div className="bg-surface shadow-sm hidden sm:block">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2">
          <Breadcrumbs />
        </div>
      </div>
    </div>
  );
}
