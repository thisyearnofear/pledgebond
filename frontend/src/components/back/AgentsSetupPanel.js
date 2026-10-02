/**
 * AgentsSetupPanel — wallet + nanopayment setup (formerly EconomyTab body).
 */

import { Card } from "@/components/common/Card";
import NanopaymentWidget from "@/components/common/NanopaymentWidget";
import TransactionFeed from "@/components/common/TransactionFeed";
import CloakDemoPanel from "@/components/common/CloakDemoPanel";

export default function AgentsSetupPanel() {
  return (
    <div className="space-y-6">
      <CloakDemoPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Wallet &amp; analysis setup</h3>
          <NanopaymentWidget compact={false} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Recent payment activity</h3>
          <TransactionFeed maxItems={15} />
        </div>
      </div>

      <Card className="p-4 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Setup wallet → pay in USDC → run AI analysis → inspect result source → decide what to back
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Fast stablecoin settlement · clearer demo/live states · fewer hidden fallbacks
        </p>
      </Card>
    </div>
  );
}
