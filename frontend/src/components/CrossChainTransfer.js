/**
 * CrossChainTransfer Component
 * Integrates with LI.FI SDK for cross-chain transfers
 */

import React, { useState, useEffect } from "react";
import { useWallet } from "@/stores/walletStore";
import { useBuilderCredit } from "@/stores/walletStore";
import { useFinancial } from "@/stores/walletStore";
import { formatUnits } from 'viem';
import { Card } from "./common/Card";
import Button from "./common/Button";
import { LoadingSpinner } from "./common/LoadingStates";
import { getUSDCAddress, getNetworkName, NETWORK_CONFIGS } from "../config/networks";
import { formatTokenAmount, truncateAddress } from "../utils/common";
import {
  ArrowsRightLeftIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

export default function CrossChainTransfer() {
  const { address: account, chainId } = useWallet();
  const { usdcBalance } = useBuilderCredit();
  const {
    lifiLoading,
    lifiError,
    getQuote,
    executeTransfer,
    transferHistory,
  } = useFinancial();

  const availableChains = Object.entries(NETWORK_CONFIGS).map(([id, config]) => {
    var nid = parseInt(id, 10);
    return { id: isNaN(nid) ? id : nid, name: config.name, icon: '' };
  });

  const [fromChain, setFromChain] = useState(null);
  const [toChain, setToChain] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slippage, setSlippage] = useState("1.0");

  // Set default chains based on current network
  useEffect(() => {
    if (availableChains.length > 0) {
      if (chainId) {
        const currentChain = availableChains.find(
          (chain) => chain.id === chainId
        );
        setFromChain(currentChain || availableChains[0]);

        // Set toChain to a different chain than fromChain
        const differentChain = availableChains.find(
          (chain) => chain.id !== (currentChain?.id || 0)
        );
        setToChain(differentChain || availableChains[1]);
      } else {
        setFromChain(availableChains[0]);
        setToChain(availableChains[1]);
      }
    }
  }, [chainId, availableChains]);

  // Display any LiFi context errors
  useEffect(() => {
    if (lifiError) {
      setError(lifiError);
    }
  }, [lifiError]);

  // Get a quote for the transfer
  const fetchQuote = async () => {
    if (!fromChain || !toChain || !amount || parseFloat(amount) <= 0) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const fromTokenAddress = getUSDCAddress(fromChain.id);
      const toTokenAddress = getUSDCAddress(toChain.id);

      if (!fromTokenAddress || !toTokenAddress) {
        throw new Error(
          `USDC token not available on ${!fromTokenAddress ? fromChain.name : toChain.name
          }`
        );
      }

      // Convert amount to the smallest unit (USDC has 6 decimals)
      const amountInSmallestUnit = parseUnits(amount, 6).toString();

      // Get quote from LiFi with options
      const quoteResult = await getQuote(
        fromChain.id,
        toChain.id,
        fromTokenAddress,
        toTokenAddress,
        amountInSmallestUnit,
        {
          slippage: slippage,
          allowSwitchChain: true,
          bridges: { deny: [] }, // Allow all bridges
        }
      );

      setQuote(quoteResult);
    } catch (err) {
      console.error("Failed to get quote:", err);
      setError(err.message || "Failed to get quote");
    } finally {
      setLoading(false);
    }
  };

  // Execute the transfer
  const processTransfer = async () => {
    if (!quote) {
      setError("Please get a quote first");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Note: network switching requires wagmi switchChain, not exposed via useWallet

      // Execute the transfer using LiFi
      const result = await executeTransfer(quote);

      setSuccess({
        txHash: result.txHash,
        fromChain: fromChain.name,
        toChain: toChain.name,
        amount,
        fee: (
          parseFloat(amount) -
          parseFloat(result.estimatedToAmount) / 1000000
        ).toFixed(2),
      });

      // Reset form
      setAmount("");
      setQuote(null);
    } catch (err) {
      console.error("Transfer failed:", err);
      setError(err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  // Swap the from and to chains
  const swapChains = () => {
    const temp = fromChain;
    setFromChain(toChain);
    setToChain(temp);
    // Reset quote when chains are swapped
    setQuote(null);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Cross-Chain Transfer
        </h2>

        {/* Information Notice */}
        <div className="bg-blue-50 p-4 rounded-lg flex items-start space-x-3 mb-6">
          <InformationCircleIcon className="w-6 h-6 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-300">
              About Cross-Chain Transfers
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
              Transfer your USDC between different blockchains using LI.FI, a
              cross-chain bridge aggregator. This enables you to use your
              funding across multiple ecosystems.
            </p>
          </div>
        </div>

        {/* Chain Selection */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {/* From Chain */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Chain
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md"
              value={fromChain?.id || ""}
              onChange={(e) => {
                const selectedChain = availableChains.find(
                  (chain) => chain.id === parseInt(e.target.value)
                );
                setFromChain(selectedChain);
                setQuote(null);
              }}
            >
              {availableChains.map((chain) => (
                <option key={`from-${chain.id}`} value={chain.id}>
                  {chain.icon} {chain.name}
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div className="flex items-center justify-center">
            <button
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
              onClick={swapChains}
            >
              <ArrowsRightLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* To Chain */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To Chain
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md"
              value={toChain?.id || ""}
              onChange={(e) => {
                const selectedChain = availableChains.find(
                  (chain) => chain.id === parseInt(e.target.value)
                );
                setToChain(selectedChain);
                setQuote(null);
              }}
            >
              {availableChains.map((chain) => (
                <option key={`to-${chain.id}`} value={chain.id}>
                  {chain.icon} {chain.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount (USDC)
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setQuote(null);
              }}
              placeholder="Enter amount"
              className="w-full p-2 border border-gray-300 rounded-md pr-16"
              min="0"
              step="0.01"
            />
            <button
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-blue-600 dark:text-blue-400 font-medium"
              onClick={() => setAmount(usdcBalance || "0")}
            >
              MAX
            </button>
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Available: {parseFloat(usdcBalance || 0).toFixed(2)} USDC
          </div>
        </div>

        {/* Quote Result */}
        {quote && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Transfer Quote</h3>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="text-gray-600 dark:text-gray-400">You Send:</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {formatUnits(
                  quote.action.fromAmount,
                  quote.action.fromToken?.decimals || 6
                )}{" "}
                {quote.action.fromToken?.symbol} on {fromChain.name}
              </div>

              <div className="text-gray-600 dark:text-gray-400">You Receive:</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {formatUnits(
                  quote.estimate.toAmount,
                  quote.action.toToken?.decimals || 6
                )}{" "}
                {quote.action.toToken?.symbol} on {toChain.name}
              </div>

              {quote.estimate.feeCosts?.length > 0 && (
                <>
                  {quote.estimate.feeCosts.map((fee, index) => (
                    <React.Fragment key={`fee-${index}`}>
                      <div className="text-gray-600 dark:text-gray-400">
                        {fee.name || `Fee ${index + 1}`}:
                      </div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {formatUnits(
                          fee.amount,
                          fee.token?.decimals || 18
                        )}{" "}
                        {fee.token?.symbol}
                      </div>
                    </React.Fragment>
                  ))}
                </>
              )}

              {quote.estimate.gasCosts?.length > 0 && (
                <>
                  {quote.estimate.gasCosts.map((gas, index) => (
                    <React.Fragment key={`gas-${index}`}>
                      <div className="text-gray-600 dark:text-gray-400">
                        {gas.name || `Gas ${index + 1}`}:
                      </div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {formatUnits(
                          gas.amount,
                          gas.token?.decimals || 18
                        )}{" "}
                        {gas.token?.symbol}
                      </div>
                    </React.Fragment>
                  ))}
                </>
              )}

              <div className="text-gray-600 dark:text-gray-400">Route:</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {quote.tool || quote.includedSteps?.[0]?.tool || "Direct"}
              </div>

              <div className="text-gray-600 dark:text-gray-400">Est. Time:</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {Math.floor((quote.estimate.executionDuration || 180) / 60)} min
              </div>
            </div>

            <Button
              onClick={processTransfer}
              disabled={loading}
              className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Processing...
                </>
              ) : (
                "Execute Transfer"
              )}
            </Button>
          </div>
        )}

        {!quote && (
          <Button
            onClick={fetchQuote}
            disabled={
              loading ||
              lifiLoading ||
              !fromChain ||
              !toChain ||
              !amount ||
              parseFloat(amount) <= 0
            }
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading || lifiLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Getting Quote...
              </>
            ) : (
              "Get Quote"
            )}
          </Button>
        )}

        {/* Advanced Options Toggle */}
        <div className="mt-4">
          <button
            type="button"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-100 flex items-center"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span className="mr-2">{showAdvanced ? "▼" : "►"}</span>
            Advanced Options
          </button>

          {showAdvanced && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Slippage Tolerance
                  </label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                  >
                    <option value="0.5">0.5%</option>
                    <option value="1.0">1.0%</option>
                    <option value="2.0">2.0%</option>
                    <option value="3.0">3.0%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gas Price (Gwei)
                  </label>
                  <input
                    type="number"
                    placeholder="Auto"
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="infinite-approval"
                    className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="infinite-approval"
                    className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    Infinite token approval (not recommended)
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="p-6 bg-red-50 border-red-200">
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 mb-1">Error</h4>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Success Message */}
      {success && (
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="flex items-start space-x-3">
            <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">
                Transfer Initiated Successfully!
              </h4>
              <p className="text-green-800 dark:text-green-300 mb-3">
                Your transfer of {success.amount} USDC from {success.fromChain}{" "}
                to {success.toChain} is in progress. You can track its status in
                the transfer history below.
              </p>

              {success.txHash && (
                <div className="bg-white bg-opacity-50 rounded-lg p-3">
                  <div className="text-sm">
                    <div className="font-medium text-green-900 dark:text-green-200">
                      Transaction Hash:
                    </div>
                    <div className="font-mono text-xs text-green-700 dark:text-green-300 break-all">
                      {success.txHash}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 text-sm text-green-800 dark:text-green-300">
                <div className="flex flex-col space-y-2">
                  <p>
                    The transfer typically takes 5-20 minutes to complete,
                    depending on network conditions.
                  </p>
                  <button
                    onClick={() => {
                      document
                        .getElementById("transfer-history-section")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-left flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-300"
                  >
                    <ChevronRightIcon className="w-4 h-4 mr-1" />
                    View in transfer history
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <GlobeAltIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Multi-Chain Support</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Transfer USDC across 15+ blockchains with the best rates and
                lowest fees.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CurrencyDollarIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Optimized Routes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                LI.FI automatically finds the best route with lowest fees and
                fastest confirmation times.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <ArrowsRightLeftIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Secure Transfers</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                All transfers are non-custodial and secure, using trusted
                cross-chain bridges.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
