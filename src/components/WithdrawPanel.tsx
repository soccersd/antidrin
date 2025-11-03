import React, { useState, useCallback } from "react";
import {
  Send,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  RefreshCw,
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
import { getWalletBalance, withdrawSponsorFunds } from "../lib/batchOps";
import { getNetworkConfig, getBlockExplorerUrl } from "../lib/rpc";
import { ethers } from "ethers";

interface WithdrawPanelProps {
  sponsorWallet: { address: string; privateKey: string } | null;
}

export default function WithdrawPanel({ sponsorWallet }: WithdrawPanelProps) {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("ethereum");
  const [balance, setBalance] = useState<string>("0");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const updateBalance = useCallback(async () => {
    if (!sponsorWallet) return;

    setIsLoadingBalance(true);
    try {
      const bal = await getWalletBalance(
        sponsorWallet.address,
        selectedNetwork,
      );
      setBalance(bal);
      setError(null);
    } catch (error) {
      console.error("Error fetching balance:", error);
      setError("Failed to fetch balance");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [sponsorWallet, selectedNetwork]);

  React.useEffect(() => {
    updateBalance();
  }, [updateBalance]);

  const handleCopyAddress = async () => {
    if (!sponsorWallet) return;
    try {
      await navigator.clipboard.writeText(sponsorWallet.address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 1500);
    } catch (copyError) {
      console.error("Failed to copy address:", copyError);
    }
  };

  const handleWithdraw = async () => {
    if (!sponsorWallet || !recipientAddress) return;

    setIsWithdrawing(true);
    setError(null);
    setTransactionHash(null);

    try {
      const sponsor = new ethers.Wallet(sponsorWallet.privateKey);
      const tx = await withdrawSponsorFunds(
        sponsor,
        recipientAddress,
        selectedNetwork,
      );

      setTransactionHash(tx.hash);
      await tx.wait(); // Wait for confirmation

      // Update balance after successful withdrawal
      await updateBalance();
    } catch (error) {
      console.error("Withdrawal failed:", error);
      setError(error instanceof Error ? error.message : "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const getExplorerUrl = (txHash: string) => {
    return getBlockExplorerUrl(selectedNetwork, "tx", txHash);
  };

  const isValidAddress = ethers.isAddress(recipientAddress);

  const nativeSymbol =
    getNetworkConfig(selectedNetwork)?.nativeCurrency.symbol ?? "";

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Withdraw Dashboard
        </CardTitle>
        <CardDescription>
          Withdraw remaining native gas tokens from your sponsor wallet to
          another address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="network">Select Network</Label>
          <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
            <SelectTrigger>
              <SelectValue placeholder="Select network" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ethereum">Ethereum Mainnet</SelectItem>
              <SelectItem value="bsc">BSC</SelectItem>
              <SelectItem value="arbitrum">Arbitrum</SelectItem>
              <SelectItem value="base">Base</SelectItem>
              <SelectItem value="polygon">Polygon</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Your Wallet Address</Label>
          <div className="flex items-center gap-2 rounded-md border border-input bg-muted px-3 py-2">
            <span className="font-mono text-sm flex-1 truncate">
              {sponsorWallet ? sponsorWallet.address : "No sponsor wallet"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyAddress}
              disabled={!sponsorWallet}
            >
              {copiedAddress ? (
                <span className="text-xs text-green-600">Copied</span>
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          {!sponsorWallet && (
            <p className="text-xs text-muted-foreground">
              Generate a sponsor wallet from the Generator tab to enable
              withdrawals.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Native Balance</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={updateBalance}
              disabled={isLoadingBalance || !sponsorWallet}
              className="gap-1"
            >
              <RefreshCw
                className={`h-3 w-3 ${isLoadingBalance ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-lg font-semibold">
              {balance} {nativeSymbol}
            </span>
            <span className="text-xs uppercase text-muted-foreground">
              {selectedNetwork}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient Address</Label>
          <Input
            id="recipient"
            placeholder="0x..."
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            className="font-mono text-sm"
          />
          {recipientAddress && !isValidAddress && (
            <p className="text-sm text-red-600">Invalid address format</p>
          )}
        </div>

        <Button
          onClick={handleWithdraw}
          disabled={
            !sponsorWallet ||
            !isValidAddress ||
            isWithdrawing ||
            parseFloat(balance) <= 0 ||
            isLoadingBalance
          }
          className="h-12 w-full text-base font-semibold"
        >
          {isWithdrawing ? "Withdrawing..." : "Withdraw All Remaining Balance"}
        </Button>

        {transactionHash && (
          <div className="flex items-start justify-between rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-3 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <div>
                <div className="font-semibold">Withdrawal Successful</div>
                <div className="font-mono text-sm">
                  {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <a
                href={getExplorerUrl(transactionHash)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div className="text-sm text-red-800">
              <div className="font-semibold mb-1">Withdrawal Failed</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        <p className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold">Note:</span> This will send the
          maximum possible amount after deducting gas fees. The transaction will
          automatically calculate the optimal amount to leave for gas.
        </p>
      </CardContent>
    </Card>
  );
}
