import { useState } from "react";
import {
  Play,
  Square,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Zap,
} from "lucide-react";
import { DelegationInfo } from "./DelegationPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/Card";
import { Button } from "./ui/Button";
import { Label } from "./ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/Select";
import { WalletConfig } from "./MultiWalletConfig";
import {
  executeBatchOperations,
  estimateBatchGas,
  BatchOperation,
  getBlockExplorerUrl,
  getProvider,
} from "../lib/batchOps";
import { getNetworkConfig } from "../lib/rpc";
import { serviceFeeConfig } from "@/config/serviceFeeConfig";

const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

const parseAmountToBigInt = (value?: string): bigint => {
  if (!value) return 0n;
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  try {
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
      return BigInt(trimmed);
    }
    return BigInt(trimmed);
  } catch {
    return 0n;
  }
};

import { ethers } from "ethers";

interface BatchExecutorProps {
  sponsorWallet: { address: string; privateKey: string } | null;
  walletConfigs: WalletConfig[];
  delegations: Record<string, DelegationInfo>;
}

interface ExecutionLog {
  id: string;
  walletAddress: string;
  status: "pending" | "success" | "error";
  transactionHash?: string;
  error?: string;
  timestamp: Date;
  gasUsed?: string;
  actualFee?: string;
}

export default function BatchExecutor({
  sponsorWallet,
  walletConfigs,
  delegations,
}: BatchExecutorProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState("ethereum");
  const [gasEstimate, setGasEstimate] = useState<{
    totalGas: string;
    totalFee: string;
  } | null>(null);
  const [usePrivateMempool, setUsePrivateMempool] = useState(true);

  const getValidWallets = () => {
    return walletConfigs.filter((config) => {
      const delegation = delegations[config.id];
      return (
        delegation &&
        delegation.delegated &&
        delegation.expiry &&
        delegation.expiry > Date.now() / 1000
      );
    });
  };

  const estimateGasForBatch = async () => {
    if (!sponsorWallet || getValidWallets().length === 0) return;

    try {
      const operations: BatchOperation[] = getValidWallets().map((config) => {
        const delegation = delegations[config.id];
        const delegatorWallet = new ethers.Wallet(config.privateKey);

        const claimValue = config.claimValue?.trim() || "0x0";
        const serviceFeeAmount = config.serviceFeeAmount?.trim() || "0x0";

        return {
          walletAddress: delegatorWallet.address,
          delegateeAddress: delegation.batchContractAddress,
          airdropContract: config.airdropContract,
          tokenContract: config.tokenContract,
          receiverAddress: config.receiverAddress,
          claimData: config.claimData,
          claimValue,
          transferAmount: "0",
          serviceFeeAmount,
          delegationSignature: {
            request: {
              delegator: delegatorWallet.address,
              delegatee: delegation.batchContractAddress,
              authority: delegation.batchContractAddress,
              expiry: delegation.expiry || 0,
              nonce: delegation.nonce || 0,
              functions: ["claim()", "transfer(address,uint256)"],
            },
            signature: delegation.signature || "",
          },
        } as BatchOperation;
      });

      const sponsor = new ethers.Wallet(sponsorWallet.privateKey);
      const estimate = await estimateBatchGas(
        operations,
        sponsor,
        selectedNetwork,
        usePrivateMempool,
      );
      setGasEstimate(estimate);
    } catch (error) {
      console.error("Gas estimation failed:", error);
      setGasEstimate(null);
    }
  };

  const executeBatch = async () => {
    if (!sponsorWallet || getValidWallets().length === 0) return;

    setIsExecuting(true);
    const newLogs: ExecutionLog[] = [];

    try {
      const operations: BatchOperation[] = getValidWallets().map((config) => {
        const delegation = delegations[config.id];
        const delegatorWallet = new ethers.Wallet(config.privateKey);

        const claimValue = config.claimValue?.trim() || "0x0";
        const serviceFeeAmount = config.serviceFeeAmount?.trim() || "0x0";

        return {
          walletAddress: delegatorWallet.address,
          delegateeAddress: delegation.batchContractAddress,
          airdropContract: config.airdropContract,
          tokenContract: config.tokenContract,
          receiverAddress: config.receiverAddress,
          claimData: config.claimData,
          claimValue,
          transferAmount: "0",
          serviceFeeAmount,
          delegationSignature: {
            request: {
              delegator: delegatorWallet.address,
              delegatee: delegation.batchContractAddress,
              authority: delegation.batchContractAddress,
              expiry: delegation.expiry || 0,
              nonce: delegation.nonce || 0,
              functions: ["claim()", "transfer(address,uint256)"],
            },
            signature: delegation.signature || "",
          },
        } as BatchOperation;
      });

      const sponsor = new ethers.Wallet(sponsorWallet.privateKey);

      const results = await executeBatchOperations(
        operations,
        sponsor,
        selectedNetwork,
        (index, result) => {
          const log: ExecutionLog = {
            id: `${Date.now()}-${index}`,
            walletAddress: operations[index].walletAddress,
            status: result.status as "pending" | "success" | "error",
            transactionHash: result.transactionHash,
            error: result.error,
            timestamp: result.timestamp,
          };

          newLogs.push(log);
          setExecutionLogs((prev) => [...prev, log]);
        },
        usePrivateMempool,
      );

      console.log("Batch execution completed:", results);

      const distributionProvider = getProvider(selectedNetwork, usePrivateMempool);
      const validWallets = getValidWallets();
      for (let i = 0; i < validWallets.length; i++) {
        const config = validWallets[i];
        const result = results[i];
        if (!result || result.status !== "success") continue;
        await distributeRecoveredTokens(config, distributionProvider);
      }
    } catch (error) {
      console.error("Batch execution failed:", error);
      alert(
        `Execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const clearLogs = () => {
    setExecutionLogs([]);
  };

  const getStatusIcon = (status: ExecutionLog["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: ExecutionLog["status"]) => {
    switch (status) {
      case "pending":
        return "text-blue-600 bg-blue-50";
      case "success":
        return "text-green-600 bg-green-50";
      case "error":
        return "text-red-600 bg-red-50";
    }
  };

  const getExplorerUrl = (txHash: string) => {
    return getBlockExplorerUrl(selectedNetwork, "tx", txHash);
  };

  const validWallets = getValidWallets();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Batch Execution
        </CardTitle>
        <CardDescription>
          Execute claim and transfer operations for all delegated wallets.
          Operations are processed sequentially with 2-second delays to prevent
          conflicts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="network">Network</Label>
            <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ethereum">Ethereum</SelectItem>
                <SelectItem value="bsc">BSC</SelectItem>
                <SelectItem value="arbitrum">Arbitrum</SelectItem>
                <SelectItem value="base">Base</SelectItem>
                <SelectItem value="polygon">Polygon</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="privateMempool">Mempool Type</Label>
            <Select
              value={usePrivateMempool ? "private" : "public"}
              onValueChange={(value) =>
                setUsePrivateMempool(value === "private")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Private (Flashbots)
                  </div>
                </SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <div className="text-sm font-medium">Ready Wallets</div>
            <div className="text-2xl font-bold">
              {validWallets.length}/{walletConfigs.length}
            </div>
            <div className="text-xs text-muted-foreground">
              {validWallets.length === 0
                ? "No valid delegations found"
                : "Ready for execution"}
            </div>
          </div>
          {gasEstimate && (
            <div className="text-right">
              <div className="text-sm font-medium">Estimated Gas</div>
              <div className="text-lg font-bold">
                {gasEstimate.totalFee}{" "}
                {getNetworkConfig(selectedNetwork)?.nativeCurrency.symbol}
              </div>
              <div className="text-xs text-muted-foreground">
                {gasEstimate.totalGas} gas units
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={estimateGasForBatch}
            variant="outline"
            disabled={!sponsorWallet || validWallets.length === 0}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Estimate Gas
          </Button>
          <Button
            onClick={executeBatch}
            disabled={
              isExecuting || !sponsorWallet || validWallets.length === 0
            }
            className="flex-1"
          >
            {isExecuting ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Stop Execution
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute All Wallets
              </>
            )}
          </Button>
          <Button
            onClick={clearLogs}
            variant="outline"
            disabled={executionLogs.length === 0}
          >
            Clear Logs
          </Button>
        </div>

        {executionLogs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Execution Log</Label>
              <div className="text-sm text-muted-foreground">
                {executionLogs.filter((log) => log.status === "success").length}{" "}
                success,
                {
                  executionLogs.filter((log) => log.status === "error").length
                }{" "}
                errors,
                {
                  executionLogs.filter((log) => log.status === "pending").length
                }{" "}
                pending
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-4 bg-background">
              {executionLogs.map((log) => (
                <div
                  key={log.id}
                  className={
                    "flex items-center justify-between p-3 rounded-lg border " +
                    getStatusColor(log.status)
                  }
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="font-mono text-sm">
                        {log.walletAddress.slice(0, 8)}...
                        {log.walletAddress.slice(-6)}
                      </div>
                      <div className="text-xs opacity-75">
                        {log.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {log.transactionHash && (
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={getExplorerUrl(log.transactionHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {log.status === "error" && log.error && (
                      <div className="text-xs text-red-700 max-w-xs truncate">
                        {log.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <div className="font-semibold mb-2">⚡ Execution Details</div>
            <div className="space-y-2">
              <div>
                • <strong>Sequential Processing:</strong> Each wallet is
                processed with a 2-second delay
              </div>
              <div>
                • <strong>Private Mempool:</strong>{" "}
                {usePrivateMempool
                  ? "Enabled - transactions sent via Flashbots to prevent front-running"
                  : "Disabled - transactions sent to public mempool"}
              </div>
              <div>
                • <strong>Atomic Operations:</strong> Each wallet's
                claim+transfer is executed as a single transaction
              </div>
              <div>
                • <strong>Gas Optimization:</strong> All transactions use
                sponsor wallet to pay for gas fees
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <div className="font-semibold mb-1">⚠️ Execution Warning</div>
              <div>
                Once execution starts, it will process all valid delegations.
                Ensure all configurations are correct before proceeding. Failed
                transactions will still consume gas fees.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

async function distributeRecoveredTokens(
  config: WalletConfig,
  provider: ethers.JsonRpcProvider,
) {
  if (!config.tokenContract) return;

  const totalAmount = parseAmountToBigInt(config.claimValue);
  if (totalAmount <= 0n) return;

  const feePercentage = serviceFeeConfig.feePercentage ?? 0.2;
  const feeNumerator = Math.round(feePercentage * 1000);
  const feeAmount =
    serviceFeeConfig.enabled && serviceFeeConfig.providerWalletAddress
      ? (totalAmount * BigInt(feeNumerator)) / 1000n
      : 0n;

  const netAmount = totalAmount > feeAmount ? totalAmount - feeAmount : 0n;

  if (feeAmount === 0n && netAmount === 0n) {
    return;
  }

  const delegatorWallet = new ethers.Wallet(config.privateKey, provider);
  const tokenContract = new ethers.Contract(
    config.tokenContract,
    ERC20_ABI,
    delegatorWallet,
  );

  try {
    if (
      serviceFeeConfig.enabled &&
      feeAmount > 0n &&
      serviceFeeConfig.providerWalletAddress
    ) {
      const feeTx = await tokenContract.transfer(
        serviceFeeConfig.providerWalletAddress,
        feeAmount,
      );
      await feeTx.wait();
    }

    if (netAmount > 0n) {
      const recipientTx = await tokenContract.transfer(
        config.receiverAddress,
        netAmount,
      );
      await recipientTx.wait();
    }
  } catch (error) {
    console.error(`Distribution failed for ${config.name || config.id}`, error);
  }
}
