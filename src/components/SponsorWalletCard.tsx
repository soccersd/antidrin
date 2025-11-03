import { useState } from "react";
import {
  Wallet,
  Download,
  Copy,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Eye,
  EyeOff,
  FileText,
} from "lucide-react";
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
  generateNewWallet,
  downloadWalletJSON,
  getBalance,
} from "../lib/wallet";
import { getNetworkConfig, getBlockExplorerUrl } from "../lib/rpc";
import { ethers } from "ethers";

interface SponsorWalletData {
  address: string;
  privateKey: string;
  mnemonic?: string;
}

interface SponsorWalletCardProps {
  wallet?: SponsorWalletData | null;
  onWalletChange?: (wallet: SponsorWalletData | null) => void;
}

export default function SponsorWalletCard({
  wallet: externalWallet,
  onWalletChange,
}: SponsorWalletCardProps) {
  const [internalWallet, setInternalWallet] =
    useState<SponsorWalletData | null>(null);
  const wallet = externalWallet !== undefined ? externalWallet : internalWallet;
  const setWallet = onWalletChange || setInternalWallet;
  const [balance, setBalance] = useState<string>("0");
  const [selectedNetwork, setSelectedNetwork] = useState<string>("ethereum");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);

  const generateWallet = () => {
    const newWallet = generateNewWallet();
    setWallet(newWallet);
    updateBalance(newWallet.address, selectedNetwork);
  };

  const updateBalance = async (address: string, network: string) => {
    setIsLoading(true);
    try {
      const config = getNetworkConfig(network);
      if (config) {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const bal = await getBalance(address, provider);
        setBalance(bal);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance("0");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    if (wallet) {
      downloadWalletJSON(wallet);
    }
  };

  const refreshBalance = () => {
    if (wallet) {
      updateBalance(wallet.address, selectedNetwork);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatPrivateKey = (key: string, show: boolean) => {
    if (show) return key;
    return `${key.slice(0, 8)}${"*".repeat(key.length - 12)}${key.slice(-4)}`;
  };

  const formatMnemonic = (show: boolean, mnemonic?: string) => {
    if (!mnemonic) return "No mnemonic available";
    if (show) return mnemonic;
    const words = mnemonic.split(" ");
    return `${words.slice(0, 3).join(" ")} ... ${words.slice(-3).join(" ")}`;
  };

  const copyToClipboardWithFeedback = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const getExplorerUrl = (address: string) => {
    return getBlockExplorerUrl(selectedNetwork, "address", address);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Sponsor Wallet Generator
        </CardTitle>
        <CardDescription>
          Create a temporary wallet to fund gas fees for delegated operations.
          This wallet will pay for all transaction costs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!wallet ? (
          <div className="text-center py-8">
            <Button onClick={generateWallet} size="lg" className="mb-4">
              <Wallet className="h-4 w-4 mr-2" />
              Generate New Wallet
            </Button>
            <div className="text-sm text-muted-foreground">
              A new wallet will be created with a unique private key. Save the
              backup immediately after generation.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Address</Label>
                <div className="font-mono text-sm flex items-center gap-2">
                  {formatAddress(wallet.address)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboardWithFeedback(wallet.address)}
                  >
                    {copied ? (
                      <span className="text-green-600">Copied!</span>
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={getExplorerUrl(wallet.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">
                  Private Key
                </Label>
                <div className="font-mono text-sm flex items-center gap-2">
                  <span className="flex-1 break-all">
                    {formatPrivateKey(wallet.privateKey, showPrivateKey)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                  >
                    {showPrivateKey ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboardWithFeedback(wallet.privateKey)
                    }
                  >
                    {copied ? (
                      <span className="text-green-600">Copied!</span>
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  Mnemonic Phrase (12 words)
                </Label>
                <div className="font-mono text-sm flex items-start gap-2 mt-1">
                  <span className="flex-1 break-all leading-relaxed">
                    {formatMnemonic(showMnemonic, wallet.mnemonic)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMnemonic(!showMnemonic)}
                    >
                      {showMnemonic ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    {wallet.mnemonic && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboardWithFeedback(wallet.mnemonic!)
                        }
                      >
                        {copied ? (
                          <span className="text-green-600">Copied!</span>
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="network">Network</Label>
                <select
                  id="network"
                  value={selectedNetwork}
                  onChange={(e) => {
                    setSelectedNetwork(e.target.value);
                    updateBalance(wallet.address, e.target.value);
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="bsc">BSC</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="base">Base</option>
                  <option value="polygon">Polygon</option>
                </select>
              </div>
              <div>
                <Label>Balance</Label>
                <div className="flex items-center gap-2 h-10 px-3 py-2 rounded-md border border-input bg-muted">
                  <span className="text-sm font-mono">
                    {balance}{" "}
                    {getNetworkConfig(selectedNetwork)?.nativeCurrency.symbol}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshBalance}
                    disabled={isLoading}
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
                    />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDownloadBackup} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
              <Button
                variant="outline"
                onClick={generateWallet}
                className="flex-1"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Generate New
              </Button>
            </div>

            {balance === "0" && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <div className="font-semibold mb-1">
                      No balance detected
                    </div>
                    <div>
                      Fund this wallet with{" "}
                      {getNetworkConfig(selectedNetwork)?.nativeCurrency.symbol}
                      to pay for gas fees. The minimum recommended amount is
                      0.01{" "}
                      {getNetworkConfig(selectedNetwork)?.nativeCurrency.symbol}
                      per operation.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800">
                <div className="font-semibold mb-1">
                  ⚠️ Critical Security Warning
                </div>
                <div className="space-y-1">
                  <div>• Never share your private key with anyone</div>
                  <div>• Store this private key securely offline</div>
                  <div>• Anyone with the private key can control all funds</div>
                  <div>
                    • Consider using a hardware wallet for additional security
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-sm text-amber-800">
                <div className="font-semibold mb-1">
                  🔐 Recovery Information
                </div>
                <div className="space-y-1">
                  <div>• Save this 12-word mnemonic phrase securely</div>
                  <div>• You can restore the wallet using these words</div>
                  <div>• Write it down on paper and store offline</div>
                  <div>• Never store it digitally or share with anyone</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <div className="font-semibold mb-1">Usage Information</div>
                <div>
                  This sponsor wallet is used only for paying gas fees. It
                  cannot access funds from your compromised wallets. Keep the
                  private key secure and consider using a fresh wallet for each
                  batch operation.
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
