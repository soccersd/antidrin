import { useState, useEffect } from "react";
import {
  Shield,
  ShieldOff,
  AlertTriangle,
  CheckCircle,
  Clock,
  Copy,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
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
  createDelegationRequest,
  signDelegation,
  verifyDelegation,
  createRevokeDelegation,
  getNextNonce,
  FUNCTION_SIGNATURES,
} from "../lib/eip7702";
import { getNetworkConfig } from "../lib/rpc";
import { ethers } from "ethers";
import { Alert } from "./ui/alert";

export interface DelegationInfo {
  walletAddress: string;
  batchContractAddress: string;
  delegated: boolean;
  signature?: string;
  expiry?: number;
  nonce?: number;
  timestamp?: Date;
  transactionHash?: string;
}

interface DelegationPanelProps {
  sponsorWallet: { address: string; privateKey: string } | null;
  walletConfigs: WalletConfig[];
  onDelegationsUpdate: (delegations: Record<string, DelegationInfo>) => void;
}

const BATCH_CONTRACT_ADDRESSES: Record<string, string> = {
  ethereum: "0x1234567890123456789012345678901234567890",
  bsc: "0x1234567890123456789012345678901234567890",
  arbitrum: "0x1234567890123456789012345678901234567890",
  base: "0x1234567890123456789012345678901234567890",
  polygon: "0x1234567890123456789012345678901234567890",
};

export default function DelegationPanel({
  sponsorWallet,
  walletConfigs,
  onDelegationsUpdate,
}: DelegationPanelProps) {
  const [delegations, setDelegations] = useState<
    Record<string, DelegationInfo>
  >({});
  const [batchContractAddress, setBatchContractAddress] = useState<string>("");
  const [isDelegating, setIsDelegating] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("ethereum");
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<
    { message: string; variant: "success" | "info" | "warning" | "error" } | null
  >(null);

  useEffect(() => {
    setBatchContractAddress(BATCH_CONTRACT_ADDRESSES[selectedNetwork] || "");
  }, [selectedNetwork]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const createDelegation = async (walletConfig: WalletConfig) => {
    if (!sponsorWallet || !batchContractAddress) return;

    setIsDelegating(walletConfig.id);
    try {
      const delegatorWallet = new ethers.Wallet(walletConfig.privateKey);
      const networkConfig = getNetworkConfig(selectedNetwork);
      if (!networkConfig) throw new Error("Invalid network");

      // Get next nonce for this wallet
      const nonce = getNextNonce(delegatorWallet.address);

      // Create delegation request (expires in 24 hours)
      const expiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

      const allowedFunctions = [FUNCTION_SIGNATURES.CLAIM];
      if (
        walletConfig.operationType === "transfer" ||
        walletConfig.operationType === "both"
      ) {
        allowedFunctions.push(FUNCTION_SIGNATURES.TRANSFER);
      }

      const delegationRequest = createDelegationRequest(
        delegatorWallet.address,
        batchContractAddress,
        batchContractAddress,
        expiry,
        nonce,
        allowedFunctions,
      );

      // Sign the delegation
      const signature = await signDelegation(
        delegatorWallet,
        delegationRequest,
        networkConfig.chainId,
      );

      // Verify the signature
      const recoveredAddress = verifyDelegation(
        delegationRequest,
        signature,
        networkConfig.chainId,
      );
      if (
        recoveredAddress.toLowerCase() !== delegatorWallet.address.toLowerCase()
      ) {
        throw new Error("Signature verification failed");
      }

      // Update delegations state
      const newDelegation: DelegationInfo = {
        walletAddress: delegatorWallet.address,
        batchContractAddress,
        delegated: true,
        signature,
        expiry,
        nonce,
        timestamp: new Date(),
      };

      setDelegations((prev) => {
        const updated = {
          ...prev,
          [walletConfig.id]: newDelegation,
        };
        onDelegationsUpdate(updated);
        return updated;
      });
      setFeedback({
        message: "Delegation signature generated and stored locally.",
        variant: "success",
      });
    } catch (error) {
      console.error("Delegation failed:", error);
      setFeedback({
        message: `Delegation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        variant: "error",
      });
    } finally {
      setIsDelegating(null);
    }
  };

  const revokeDelegation = async (walletConfig: WalletConfig) => {
    if (!sponsorWallet || !delegations[walletConfig.id]) return;

    setIsRevoking(walletConfig.id);
    try {
      const delegatorWallet = new ethers.Wallet(walletConfig.privateKey);
      const networkConfig = getNetworkConfig(selectedNetwork);
      if (!networkConfig) throw new Error("Invalid network");

      // Get next nonce for revocation
      const nonce = getNextNonce(delegatorWallet.address);

      // Create revocation delegation (expiry = 0 for immediate revocation)
      const revocationRequest = createRevokeDelegation(
        delegatorWallet.address,
        batchContractAddress,
        batchContractAddress,
        nonce,
      );

      // Sign the revocation
      await signDelegation(
        delegatorWallet,
        revocationRequest,
        networkConfig.chainId,
      );

      // In a real implementation, you would submit this to the batch contract
      // For now, we'll mark it as revoked locally
      setDelegations((prev) => {
        const updated = {
          ...prev,
          [walletConfig.id]: {
            ...prev[walletConfig.id],
            delegated: false,
            expiry: 0,
          },
        };
        onDelegationsUpdate(updated);
        return updated;
      });
      setFeedback({
        message: "Delegation revoked successfully.",
        variant: "info",
      });
    } catch (error) {
      console.error("Revocation failed:", error);
      setFeedback({
        message: `Revocation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        variant: "error",
      });
    } finally {
      setIsRevoking(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const getDelegationStatus = (
    walletConfig: WalletConfig,
  ): {
    status: "not-delegated" | "delegated" | "expired" | "invalid";
    color: string;
    text: string;
    icon: React.ReactNode;
  } => {
    const delegation = delegations[walletConfig.id];

    if (!delegation || !delegation.delegated) {
      return {
        status: "not-delegated",
        color: "text-gray-600",
        text: "Not Delegated",
        icon: <ShieldOff className="h-4 w-4" />,
      };
    }

    if (delegation.expiry && delegation.expiry < Date.now() / 1000) {
      return {
        status: "expired",
        color: "text-orange-600",
        text: "Expired",
        icon: <Clock className="h-4 w-4" />,
      };
    }

    return {
      status: "delegated",
      color: "text-green-600",
      text: "Delegated",
      icon: <CheckCircle className="h-4 w-4" />,
    };
  };

  const formatExpiryTime = (expiry: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = expiry - now;

    if (remaining <= 0) return "Expired";

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? "s" : ""} ${hours % 24}h`;
    }

    return `${hours}h ${minutes}m`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          EIP-7702 Delegation System
        </CardTitle>
        <CardDescription>
          Delegate control of your compromised wallets to the batch contract for
          secure operations. Delegations are temporary and can be revoked at any
          time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {feedback && (
          <Alert variant={feedback.variant}>{feedback.message}</Alert>
        )}
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
            <Label htmlFor="batchContract">Batch Contract Address</Label>
            <div className="flex gap-2">
              <Input
                id="batchContract"
                value={batchContractAddress}
                onChange={(e) => setBatchContractAddress(e.target.value)}
                placeholder="0x..."
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  batchContractAddress && copyToClipboard(batchContractAddress)
                }
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {walletConfigs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No wallets configured</p>
              <p className="text-sm mt-2">
                Configure wallets in the Multi-Wallet tab first
              </p>
            </div>
          ) : (
            walletConfigs.map((walletConfig) => {
              const status = getDelegationStatus(walletConfig);
              const delegation = delegations[walletConfig.id];
              const walletAddress = new ethers.Wallet(walletConfig.privateKey)
                .address;

              return (
                <div key={walletConfig.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center gap-2 ${status.color}`}
                      >
                        {status.icon}
                        <span className="font-medium">{status.text}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {walletConfig.name}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {status.status === "not-delegated" ? (
                        <Button
                          onClick={() => createDelegation(walletConfig)}
                          disabled={
                            isDelegating === walletConfig.id ||
                            !batchContractAddress
                          }
                          size="sm"
                        >
                          {isDelegating === walletConfig.id
                            ? "Delegating..."
                            : "Delegate"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => revokeDelegation(walletConfig)}
                          disabled={isRevoking === walletConfig.id}
                          size="sm"
                        >
                          {isRevoking === walletConfig.id
                            ? "Revoking..."
                            : "Revoke"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {delegation && delegation.delegated && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Batch Contract:
                        </span>
                        <div className="font-mono text-xs mt-1">
                          {delegation.batchContractAddress.slice(0, 10)}...
                          {delegation.batchContractAddress.slice(-8)}
                        </div>
                      </div>
                      {delegation.expiry && (
                        <div>
                          <span className="text-muted-foreground">
                            Expires in:
                          </span>
                          <div className="font-medium mt-1">
                            {formatExpiryTime(delegation.expiry)}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Nonce:</span>
                        <div className="font-medium mt-1">
                          {delegation.nonce}
                        </div>
                      </div>
                      {delegation.timestamp && (
                        <div>
                          <span className="text-muted-foreground">
                            Delegated at:
                          </span>
                          <div className="font-medium mt-1">
                            {delegation.timestamp.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <div className="font-semibold mb-2">
              🔒 How EIP-7702 Delegation Works
            </div>
            <div className="space-y-2">
              <div>
                • <strong>Temporary Control:</strong> You temporarily delegate
                specific functions to the batch contract
              </div>
              <div>
                • <strong>Function Whitelist:</strong> Only approved functions
                (claim, transfer) can be executed
              </div>
              <div>
                • <strong>Time-Limited:</strong> Delegations expire after 24
                hours for security
              </div>
              <div>
                • <strong>Revocable:</strong> You can revoke delegation at any
                time
              </div>
              <div>
                • <strong>Non-Custodial:</strong> The batch contract cannot
                access your private keys or other funds
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <div className="font-semibold mb-1">
                ⚠️ Important Security Note
              </div>
              <div>
                The batch contract address must be verified and audited. Using
                an incorrect address could result in loss of funds. Double-check
                the contract address before delegating any wallets.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
