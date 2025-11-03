import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/Tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/Card";
import { Switch } from "./components/ui/switch";
import {
  Sun,
  Moon,
  BadgeCheckIcon,
  AlertCircleIcon,
  CheckIcon,
  Sparkles,
  Zap,
  ArrowDownToLine,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Alert } from "./components/ui/alert";
import { BackgroundRippleEffect } from "./components/ui/background-ripple-effect";

import MultiWalletConfig from "./components/MultiWalletConfig";
import SponsorWalletCard from "./components/SponsorWalletCard";
import WithdrawPanel from "./components/WithdrawPanel";
import { WalletConfig } from "./components/MultiWalletConfig";
import OperationConfigurationCard from "./components/OperationConfigurationCard";
import DelegationPanel, { DelegationInfo } from "./components/DelegationPanel";
import BatchExecutor, {
  BatchExecutorHandle,
} from "./components/BatchExecutor";
import { serviceFeeConfig } from "./config/serviceFeeConfig";
import {
  formatHexValue,
  isValidValueInput,
  parseValueInput,
} from "./lib/valueParsing";
function App() {
  const [sponsorWallet, setSponsorWallet] = useState<{
    address: string;
    privateKey: string;
  } | null>(null);
  const [walletConfigs, setWalletConfigs] = useState<WalletConfig[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [delegations, setDelegations] = useState<Record<string, DelegationInfo>>({});
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(
    serviceFeeConfig.enabled,
  );
  const batchExecutorRef = useRef<BatchExecutorHandle>(null);
  useEffect(() => {
    if (walletConfigs.length === 0) {
      setSelectedWalletId(null);
      return;
    }
    const exists = walletConfigs.some((config) => config.id === selectedWalletId);
    if (!selectedWalletId || !exists) {
      setSelectedWalletId(walletConfigs[0].id);
    }
  }, [walletConfigs, selectedWalletId]);

  const handleServiceFeeToggle = (enabled: boolean) => {
    setServiceFeeEnabled(enabled);
    serviceFeeConfig.enabled = enabled;
    const feeNumerator = Math.round(
      (serviceFeeConfig.feePercentage ?? 0.2) * 1000,
    );
    setWalletConfigs((prev) =>
      prev.map((config) => {
        const claimInput = config.claimValue?.trim() ?? "";
        const transferInput = config.transferAmount?.trim() ?? "";
        const claimAmount =
          claimInput && isValidValueInput(claimInput)
            ? parseValueInput(claimInput)
            : 0n;
        const transferAmount =
          transferInput && isValidValueInput(transferInput)
            ? parseValueInput(transferInput)
            : 0n;
        const baseAmount = claimAmount > transferAmount ? claimAmount : transferAmount;
        // Whenever the fee toggle flips we normalise each wallet's cached fee so
        // the downstream executor doesn't have to recalculate on the fly.
        const feeAmount = enabled
          ? (baseAmount * BigInt(feeNumerator)) / 1000n
          : 0n;
        return {
          ...config,
          serviceFeeAmount: formatHexValue(feeAmount),
        };
      }),
    );
  };

  const delegationReadyMap = useMemo(() => {
    return walletConfigs.reduce<Record<string, boolean>>((acc, config) => {
      const delegation = delegations[config.id];
      const delegationValid =
        !!delegation &&
        delegation.delegated &&
        (!delegation.expiry || delegation.expiry > Date.now() / 1000);

      const hasPrivateKey = config.privateKey.trim().length > 0;
      const hasAirdropContract = config.airdropContract.trim().length > 0;
      const hasReceiver = config.receiverAddress.trim().length > 0;
      const hasTokenContract =
        config.operationType === "transfer" || config.operationType === "both"
          ? (config.tokenContract || "").trim().length > 0
          : true;
      const needsClaimData =
        config.operationType === "claim" || config.operationType === "both";
      const hasClaimData = needsClaimData
        ? config.claimData.trim().length > 0
        : true;
      const claimValid = isValidValueInput(config.claimValue);
      const transferValid = isValidValueInput(config.transferAmount);

      acc[config.id] =
        hasPrivateKey &&
        hasAirdropContract &&
        hasReceiver &&
        hasTokenContract &&
        hasClaimData &&
        claimValid &&
        transferValid &&
        delegationValid;
      return acc;
    }, {});
  }, [walletConfigs, delegations]);

  const hasExecutableWallet = useMemo(
    () => Object.values(delegationReadyMap).some(Boolean),
    [delegationReadyMap],
  );

  const handleExecuteBatch = async () => {
    if (!batchExecutorRef.current) return;
    await batchExecutorRef.current.executeBatch();
  };

  const [isDarkMode, setIsDarkMode] = useState(false);

  const renderMainPage = () => (
    <div
      className={`relative min-h-screen bg-background ${isDarkMode ? "dark" : ""}`}
    >
      <BackgroundRippleEffect rows={15} cols={40} cellSize={40} />
      <div className="container mx-auto py-8 relative z-10">
        {/* Global Status Alerts */}
        <div className="mb-6 space-y-3">
          {sponsorWallet && (
            <Alert variant="success">
              Sponsor wallet connected and ready for operations
            </Alert>
          )}
          {walletConfigs.length > 0 && (
            <Alert variant="info">
              {walletConfigs.length} wallet(s) configured and ready for batch
              execution
            </Alert>
          )}
          {walletConfigs.length === 0 && (
            <Alert variant="warning">
              No wallets configured yet. Add wallets to start batch operations.
            </Alert>
          )}
        </div>

        {/* Navigation Bar */}
        <div className="mb-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-3">
              <h1 className="text-5xl font-bold text-primary">
                Antidrain by shark
              </h1>
              <Badge className="bg-green-500 text-white">
                <CheckIcon className="h-3 w-3 mr-1" />
                Online
              </Badge>
            </div>
            <p className="max-w-2xl text-muted-foreground">
              Generate secure sponsor wallets, configure batch operations, and
              withdraw remaining gas funds in a single streamlined interface.
            </p>
            <div className="flex items-center gap-3">
              <Badge variant="outline">
                <BadgeCheckIcon className="h-3 w-3 mr-1" />
                {walletConfigs.length} Wallet{walletConfigs.length === 1 ? "" : "s"}
                &nbsp;configured
              </Badge>
              {sponsorWallet && (
                <Badge className="bg-blue-500 text-white">
                  Sponsor Connected
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <Switch checked={isDarkMode} onCheckedChange={setIsDarkMode} />
              <Moon className="h-4 w-4" />
            </div>
          </div>
        </div>

        <Tabs defaultValue="generator" className="w-full">
          <div className="flex justify-center">
            <TabsList className="inline-flex gap-2 rounded-full bg-muted p-1">
              <TabsTrigger
                value="generator"
                className="flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold"
              >
                <Sparkles className="h-4 w-4" />
                Generator
              </TabsTrigger>
              <TabsTrigger
                value="batch"
                className="flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold"
              >
                <Zap className="h-4 w-4" />
                Batch Ops
              </TabsTrigger>
              <TabsTrigger
                value="withdraw"
                className="flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold"
              >
                <ArrowDownToLine className="h-4 w-4" />
                Withdraw
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="generator" className="mt-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sponsor Wallet Configuration</CardTitle>
                    <CardDescription>
                      Configure sponsor wallet that will pay gas fees for all
                      batch operations.
                    </CardDescription>
                  </div>
                  {sponsorWallet ? (
                    <Badge className="bg-green-500 text-white">
                      <BadgeCheckIcon className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircleIcon className="h-3 w-3 mr-1" />
                      Not Set
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!sponsorWallet && (
                  <Alert variant="warning" className="mb-4">
                    Sponsor wallet is required before proceeding with batch
                    operations
                  </Alert>
                )}
                <SponsorWalletCard
                  wallet={sponsorWallet}
                  onWalletChange={setSponsorWallet}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="batch" className="mt-8">
            <div className="space-y-6">
              <MultiWalletConfig
                configs={walletConfigs}
                selectedWalletId={selectedWalletId}
                onConfigsChange={setWalletConfigs}
                onSelectWallet={setSelectedWalletId}
                delegations={delegations}
                serviceFeeEnabled={serviceFeeEnabled}
                onServiceFeeToggle={handleServiceFeeToggle}
              />
              <DelegationPanel
                sponsorWallet={sponsorWallet}
                walletConfigs={walletConfigs}
                onDelegationsUpdate={setDelegations}
              />
              <OperationConfigurationCard
                walletConfigs={walletConfigs}
                selectedWalletId={selectedWalletId}
                onWalletUpdate={(id, updates) =>
                  setWalletConfigs((prev) =>
                    prev.map((config) =>
                      config.id === id ? { ...config, ...updates } : config,
                    ),
                  )
                }
                onExecuteAll={handleExecuteBatch}
                delegationsReadyMap={delegationReadyMap}
                disableExecute={!hasExecutableWallet}
              />
              <BatchExecutor
                ref={batchExecutorRef}
                sponsorWallet={sponsorWallet}
                walletConfigs={walletConfigs}
                delegations={delegations}
              />
            </div>
          </TabsContent>

          <TabsContent value="withdraw" className="mt-8">
            {!sponsorWallet && (
              <Alert variant="warning" className="mb-4">
                Configure a sponsor wallet before withdrawing remaining funds.
              </Alert>
            )}
            <WithdrawPanel sponsorWallet={sponsorWallet} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  return renderMainPage();
}

export default App;
