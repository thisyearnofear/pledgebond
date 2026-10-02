import React from "react";
import Button from "@/components/common/Button";
import { useRouter } from "next/router";

/**
 * PaymentFlowSection - Visualizes the x402 nanopayment flow
 * @returns {JSX.Element} Payment flow section component
 */
export function PaymentFlow() {
  const router = useRouter();

  return (
    <div className="py-12 sm:py-16 bg-gradient-to-b from-teal-50 to-white dark:from-teal-950/50 dark:to-gray-900 border-t border-teal-100 dark:border-teal-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 rounded-full text-xs font-semibold mb-4">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            AI-Powered Analysis
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-3">
            How AI Agents Analyze Your Projects
          </h2>
          <p className="text-sm sm:text-base text-secondary max-w-2xl mx-auto">
            Per-query AI agents assess builder quality — paid instantly via x402 nanopayments in USDC
          </p>
        </div>

        {/* Visual Flow Diagram */}
        <div className="relative max-w-4xl mx-auto mb-10">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            {/* Step 1: User */}
            <div className="bg-white rounded-xl border-2 border-blue-200 dark:border-blue-800 dark:bg-gray-800 shadow-sm p-4 text-center">
              <div className="text-3xl mb-2">👤</div>
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">You</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Request analysis</p>
            </div>
            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 dark:text-gray-300 mb-1">$0.01–0.05</span>
                <div className="w-full h-0.5 bg-gradient-to-r from-blue-300 to-teal-300 dark:from-blue-700 dark:to-teal-700 relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-6 border-transparent border-l-teal-400 dark:border-l-teal-600" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-300 mt-1">USDC</span>
              </div>
            </div>
            <div className="md:hidden flex justify-center">
              <span className="text-gray-300 dark:text-gray-400 text-xl">↓</span>
            </div>
            {/* Step 2: Gateway */}
            <div className="bg-white rounded-xl border-2 border-teal-200 dark:border-teal-700 dark:bg-gray-800 shadow-sm p-4 text-center">
              <div className="text-3xl mb-2">🔐</div>
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Circle Gateway</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Settles via x402</p>
            </div>
            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 dark:text-gray-300 mb-1">analyze</span>
                <div className="w-full h-0.5 bg-gradient-to-r from-teal-300 to-purple-300 dark:from-teal-700 dark:to-purple-700 relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-6 border-transparent border-l-purple-400 dark:border-l-purple-600" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-300 mt-1">score</span>
              </div>
            </div>
            <div className="md:hidden flex justify-center">
              <span className="text-gray-300 dark:text-gray-400 text-xl">↓</span>
            </div>
            {/* Step 3: AI Agent */}
            <div className="bg-white rounded-xl border-2 border-purple-200 dark:border-purple-800 dark:bg-gray-800 shadow-sm p-4 text-center">
              <div className="text-3xl mb-2">🤖</div>
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">AI Agent</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Returns health score</p>
            </div>
          </div>
          {/* Secondary: Agent → LLM inference */}
          <div className="mt-4 flex justify-center">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 inline-flex items-center gap-3 text-xs text-gray-500 dark:text-gray-300">
              <span>🤖 Agent</span>
              <span className="text-gray-400 dark:text-gray-400">→ pays →</span>
              <span>🧠 LLM Inference</span>
              <span className="text-gray-400 dark:text-gray-400">→ settled in</span>
              <span className="font-semibold text-teal-600 dark:text-teal-400">USDC</span>
            </div>
          </div>
        </div>

        {/* Simple Terms Explanation */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-2xl border border-teal-100 dark:border-teal-900 p-6 sm:p-8 max-w-4xl mx-auto shadow-sm">
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">💡</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-primary mb-2">In Simple Terms:</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Think of <strong>x402 Nanopayments</strong> like an instant, micro-tip (pennies!) you pay to an AI agent 
                to double-check your work. Instead of monthly subscriptions, you only pay for what you use, 
                when you use it. It&apos;s fast, cheap, and settles instantly on-chain.
              </p>
            </div>
          </div>
        </div>

        {/* Agent Pricing + CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <div className="flex flex-wrap gap-3">
            <span className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-800 rounded-lg text-xs font-medium text-teal-700 dark:text-teal-300">
              🤖 Underwriter — $0.05
            </span>
            <span className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-800 rounded-lg text-xs font-medium text-teal-700 dark:text-teal-300">
              🔍 Scout — $0.01
            </span>
            <span className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-800 rounded-lg text-xs font-medium text-teal-700 dark:text-teal-300">
              ✅ Verifier — $0.001
            </span>
          </div>
          <Button
            onClick={() => router.push("/back")}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 text-sm font-semibold"
          >
            ⚡ Analyze a Project
          </Button>
        </div>
      </div>
    </div>
  );
}
