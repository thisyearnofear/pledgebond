/**
 * UserMenuItems — The list of links inside the user dropdown.
 *
 * Extracted from Navbar because both the desktop and mobile dropdowns
 * share most of the same item set; the only difference is that the
 * desktop version includes the Verification + Payout Simulator links
 * (which are non-essential for mobile).
 *
 * Props:
 * - `userRole`: gates the Verification/Payout items.
 * - `githubUsername`: gates the Portfolio link.
 * - `onSignOut`: handler passed to the Sign out link.
 * - `compact`: tightens paddings for the mobile dropdown.
 */

import { Fragment } from "react";
import Link from "next/link";
import { Menu } from "@headlessui/react";
import {
  UserCircleIcon,
  CreditCardIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { classNames } from "@/utils/common";

/**
 * @typedef {{
 *   userRole: "builder" | "backer" | null,
 *   githubUsername: string | null,
 *   onSignOut: () => void,
 *   compact?: boolean,
 * }} UserMenuItemsProps
 */

export default function UserMenuItems(/** @type {UserMenuItemsProps} */ {
  userRole,
  githubUsername,
  onSignOut,
  compact = false,
}) {
  const py = compact ? "py-2.5" : "py-2";
  return (
    <Fragment>
      <div className="py-1">
        {githubUsername && (
          <Menu.Item>
            {({ active }) => (
              <Link
                href={`/u/${githubUsername}`}
                className={classNames(
                  active ? "bg-gray-50 dark:bg-gray-700/50" : "",
                  `flex items-center px-4 ${py} text-sm text-primary`,
                )}
              >
                <GlobeAltIcon className="mr-3 h-4 w-4 text-muted" /> My Portfolio
              </Link>
            )}
          </Menu.Item>
        )}
        <Menu.Item>
          {({ active }) => (
            <Link
              href="/profile"
              className={classNames(
                active ? "bg-gray-50 dark:bg-gray-700/50" : "",
                `flex items-center px-4 ${py} text-sm text-primary`,
              )}
            >
              <UserCircleIcon className="mr-3 h-4 w-4 text-muted" /> Profile &amp; Wallets
            </Link>
          )}
        </Menu.Item>
        <Menu.Item>
          {({ active }) => (
            <Link
              href="/build"
              className={classNames(
                active ? "bg-gray-50 dark:bg-gray-700/50" : "",
                `flex items-center px-4 ${py} text-sm text-primary`,
              )}
            >
              <CreditCardIcon className="mr-3 h-4 w-4 text-muted" /> Credit Dashboard
            </Link>
          )}
        </Menu.Item>
        {!compact && userRole !== "backer" && (
          <>
            <Menu.Item>
              {({ active }) => (
                <Link
                  href="/admin/verification"
                  className={classNames(
                    active ? "bg-orange-50 dark:bg-orange-900/20" : "",
                    `flex items-center px-4 ${py} text-sm text-orange-700 dark:text-orange-400 font-semibold`,
                  )}
                >
                  <ShieldCheckIcon className="mr-3 h-4 w-4" /> Verification Dashboard
                </Link>
              )}
            </Menu.Item>
          </>
        )}
      </div>
      <div className="border-t border-default py-1">
        <Menu.Item>
          {({ active }) => (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onSignOut();
              }}
              className={classNames(
                active ? "bg-red-50 dark:bg-red-900/20" : "",
                `flex items-center px-4 ${py} text-sm text-red-600 dark:text-red-400`,
              )}
            >
              Sign out
            </a>
          )}
        </Menu.Item>
      </div>
    </Fragment>
  );
}
