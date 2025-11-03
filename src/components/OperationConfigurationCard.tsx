import { useEffect, useMemo, useState } from "react";
import { Zap, Info, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/Card";
import { Button } from "./ui/Button";
import { Label } from "./ui/Label";
import { Textarea } from "./ui/Textarea";
import { Input } from "./ui/Input";
import { WalletConfig } from "./MultiWalletConfig";
import { cn } from "@/lib/utils";
import { serviceFeeConfig } from "@/config/serviceFeeConfig";
import {
  formatDecimalValue,
  formatHexValue,
  isValidValueInput,
  parseValueInput,
} from "@/lib/valueParsing";

interface OperationConfigurationCardProps {
  walletConfigs: WalletConfig[];
  selectedWalletId: string | null;
  onWalletUpdate: (id: string, updates: Partial<WalletConfig>) => void;
  onExecuteAll: () => void;
  delegationsReadyMap?: Record<string, boolean>;
  disableExecute?: boolean;
}

const OPERATION_OPTIONS: Array<WalletConfig["operationType"]> = [
  "claim",
  "transfer",
  "both",
];

const OPERATION_LABELS: Record<WalletConfig["operationType"], string> = {
  claim: "Only Claim",
  transfer: "Only Transfer",
  both: "Claim and Transfer (Both)",
};

export default function OperationConfigurationCard({
  walletConfigs,
  selectedWalletId,
  onWalletUpdate,
  onExecuteAll,
  delegationsReadyMap = {},
  disableExecute = false,
}: OperationConfigurationCardProps) {
  const currentWallet = useMemo(
    () =>
      walletConfigs.find((config) => config.id === selectedWalletId) ||
      walletConfigs[0],
    [walletConfigs, selectedWalletId],
  );

  const totalWallets = walletConfigs.length;
  const buttonLabel =
    totalWallets > 0
      ? `Execute All Wallets (${totalWallets})`
      : "Execute All Wallets";

  const claimValueInputRaw = currentWallet?.claimValue ?? "";
  const claimValueInput = claimValueInputRaw.trim();
  const transferAmountInputRaw = currentWallet?.transferAmount ?? "";
  const transferAmountInput = transferAmountInputRaw.trim();
  const feePercentage = serviceFeeConfig.feePercentage ?? 0.2;
  const feeNumerator = Math.round(feePercentage * 1000);

  const [claimValueError, setClaimValueError] = useState<string | null>(null);
  const [transferAmountError, setTransferAmountError] = useState<string | null>(
    null,
  );

  const claimValueIsValid = useMemo(() => {
    if (!claimValueInput) return true;
    return isValidValueInput(claimValueInput);
  }, [claimValueInput]);

  const transferAmountIsValid = useMemo(() => {
    if (!transferAmountInput) return true;
    return isValidValueInput(transferAmountInput);
  }, [transferAmountInput]);

  useEffect(() => {
    setClaimValueError(
      claimValueIsValid ? null : "Enter a decimal or 0x-prefixed hexadecimal value.",
    );
  }, [claimValueIsValid]);

  useEffect(() => {
    setTransferAmountError(
      transferAmountIsValid
        ? null
        : "Enter a decimal or 0x-prefixed hexadecimal value.",
    );
  }, [transferAmountIsValid]);

  const claimValueBigInt = useMemo(() => {
    if (!claimValueIsValid) return 0n;
    try {
      return parseValueInput(claimValueInput || "0");
    } catch {
      return 0n;
    }
  }, [claimValueInput, claimValueIsValid]);

  const transferValueBigInt = useMemo(() => {
    if (!transferAmountIsValid) return 0n;
    try {
      return parseValueInput(transferAmountInput || "0");
    } catch {
      return 0n;
    }
  }, [transferAmountInput, transferAmountIsValid]);

  const baseValue = useMemo(
    () => (claimValueBigInt > transferValueBigInt ? claimValueBigInt : transferValueBigInt),
    [claimValueBigInt, transferValueBigInt],
  );

  const feeBigInt = useMemo(() => {
    if (!serviceFeeConfig.enabled) return 0n;
    // Service fees are always calculated from the larger of the claim or transfer
    // amounts to ensure the rescue flow covers the maximum outbound value.
    return (baseValue * BigInt(feeNumerator)) / 1000n;
  }, [baseValue, feeNumerator, serviceFeeConfig.enabled]);

  const netBigInt = useMemo(
    () => (baseValue > feeBigInt ? baseValue - feeBigInt : 0n),
    [baseValue, feeBigInt],
  );

  const claimValueHex = useMemo(
    () => formatHexValue(claimValueBigInt),
    [claimValueBigInt],
  );
  const claimValueDecimal = useMemo(
    () => formatDecimalValue(claimValueBigInt),
    [claimValueBigInt],
  );
  const transferValueHex = useMemo(
    () => formatHexValue(transferValueBigInt),
    [transferValueBigInt],
  );
  const transferValueDecimal = useMemo(
    () => formatDecimalValue(transferValueBigInt),
    [transferValueBigInt],
  );
  const feeHex = useMemo(() => formatHexValue(feeBigInt), [feeBigInt]);
  const feeDecimal = useMemo(
    () => formatDecimalValue(feeBigInt),
    [feeBigInt],
  );
  const netHex = useMemo(() => formatHexValue(netBigInt), [netBigInt]);
  const netDecimal = useMemo(
    () => formatDecimalValue(netBigInt),
    [netBigInt],
  );

  const showExecuteDisabledReason = useMemo(() => {
    if (!currentWallet) return null;
    if (!delegationsReadyMap[currentWallet.id]) {
      return "Delegation is not active for this wallet.";
    }
    if (!currentWallet.privateKey.trim()) {
      return "Private key is required.";
    }
    if (!currentWallet.airdropContract.trim()) {
      return "Airdrop contract is required.";
    }
    if (
      (currentWallet.operationType === "claim" ||
        currentWallet.operationType === "both") &&
      !currentWallet.claimData.trim()
    ) {
      return "Claim data is required for claim operations.";
    }
    if (!currentWallet.receiverAddress.trim()) {
      return "Receiver address is required.";
    }
    return null;
  }, [currentWallet, delegationsReadyMap]);

  useEffect(() => {
    if (!currentWallet) return;

    if (!claimValueIsValid || !transferAmountIsValid) {
      // Short-circuit if either field is invalid to avoid writing misleading
      // fee data back into the wallet configuration.
      onWalletUpdate(currentWallet.id, {
        serviceFeeAmount: formatHexValue(0n),
      });
      return;
    }

    const updatedFeeHex = formatHexValue(feeBigInt);
    if (currentWallet.serviceFeeAmount !== updatedFeeHex) {
      // Keep the persisted configuration in sync with the derived fee so the
      // batch executor can rely on a single source of truth.
      onWalletUpdate(currentWallet.id, {
        serviceFeeAmount: updatedFeeHex,
      });
    }
  }, [
    claimValueIsValid,
    transferAmountIsValid,
    feeBigInt,
    currentWallet,
    onWalletUpdate,
  ]);

  const [isOperationGuideOpen, setIsOperationGuideOpen] = useState(false);
  const [isHexGuideOpen, setIsHexGuideOpen] = useState(false);
  const [isClaimValueGuideOpen, setIsClaimValueGuideOpen] = useState(false);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Zap className="h-5 w-5 text-primary" />
          Operation Configuration
        </CardTitle>
        <CardDescription>
          Configure sensitive inputs and execution parameters for the selected
          wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!currentWallet ? (
          <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted px-6 py-10 text-center text-muted-foreground">
            Add a wallet in the configuration panel above to unlock operation
            settings.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Operation Type</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => setIsOperationGuideOpen((prev) => !prev)}
                >
                  {isOperationGuideOpen ? "Hide info" : "Show info"}
                  {isOperationGuideOpen ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {OPERATION_OPTIONS.map((option) => {
                  const isActive = currentWallet.operationType === option;
                  return (
                    <Button
                      key={option}
                      variant={isActive ? "default" : "outline"}
                      className={cn(
                        "h-auto justify-start gap-2 rounded-xl border px-4 py-3 text-left",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-primary/10",
                      )}
                      onClick={() =>
                        onWalletUpdate(currentWallet.id, {
                          operationType: option,
                        })
                      }
                    >
                      {OPERATION_LABELS[option]}
                    </Button>
                  );
                })}
              </div>
              {isOperationGuideOpen && <OperationTypeGuide />}
            </div>

            <div className="space-y-2">
              <Label htmlFor="private-key">Compromised Private Key *</Label>
              <Textarea
                id="private-key"
                placeholder="Enter your compromised/hacked wallet's private key here"
                value={currentWallet.privateKey}
                onChange={(e) =>
                  onWalletUpdate(currentWallet.id, {
                    privateKey: e.target.value,
                  })
                }
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Your private keys never leave your device and are never
                transmitted to any server, nor stored by us. For more info read
                FAQ{" "}
                <a href="/faq" className="text-primary underline">
                  here
                </a>
                .
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Airdrop/Target Contract Address *
                <Info className="h-4 w-4 text-primary" />
              </Label>
              <Input
                placeholder="The contract you want to interact with (airdrop, staking, etc.)"
                value={currentWallet.airdropContract}
                onChange={(e) =>
                  onWalletUpdate(currentWallet.id, {
                    airdropContract: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Claim Hex Data *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => setIsHexGuideOpen((prev) => !prev)}
                >
                  {isHexGuideOpen ? "Hide info" : "Show info"}
                  {isHexGuideOpen ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Paste the HEX payload from Rabby (e.g. 0xadcea55a...)"
                value={currentWallet.claimData}
                onChange={(e) =>
                  onWalletUpdate(currentWallet.id, {
                    claimData: e.target.value,
                  })
                }
                rows={4}
              />
              {isHexGuideOpen && <ClaimHexGuide />}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Claim Value (WEI)
              </Label>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Raw value from Rabby (hex or decimal)
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => setIsClaimValueGuideOpen((prev) => !prev)}
                >
                  {isClaimValueGuideOpen ? "Hide info" : "Show info"}
                  {isClaimValueGuideOpen ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <Input
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="Enter raw value (e.g. 0x1d1a94a2000 or 0)"
                value={currentWallet.claimValue ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const normalized = raw.trim();
                  const isValid = isValidValueInput(normalized) || normalized === "";
                  if (!isValid) {
                    setClaimValueError(
                      "Enter a decimal or 0x-prefixed hexadecimal value.",
                    );
                  } else {
                    setClaimValueError(null);
                  }
                  let updatedFee = feeBigInt;
                  if (isValid) {
                    const claimAmount = normalized ? parseValueInput(normalized) : 0n;
                    const transferAmount = transferAmountIsValid
                      ? transferValueBigInt
                      : 0n;
                    const base = claimAmount > transferAmount ? claimAmount : transferAmount;
                    updatedFee = serviceFeeConfig.enabled
                      ? (base * BigInt(feeNumerator)) / 1000n
                      : 0n;
                  }
                  onWalletUpdate(currentWallet.id, {
                    claimValue: raw,
                    serviceFeeAmount: formatHexValue(updatedFee),
                  });
                }}
              />
              {claimValueError && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {claimValueError}
                </div>
              )}
              {isClaimValueGuideOpen && <ClaimValueGuide />}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Transfer Amount (WEI)
              </Label>
              <span className="text-xs text-muted-foreground">
                Optional extra transfer for ERC-20 rescues (hex or decimal)
              </span>
              <Input
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="Enter raw transfer value (e.g. 0x16345785d8a0000 or 0)"
                value={currentWallet.transferAmount ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const normalized = raw.trim();
                  const isValid = isValidValueInput(normalized) || normalized === "";
                  if (!isValid) {
                    setTransferAmountError(
                      "Enter a decimal or 0x-prefixed hexadecimal value.",
                    );
                  } else {
                    setTransferAmountError(null);
                  }
                  let updatedFee = feeBigInt;
                  if (isValid) {
                    const transferAmount = normalized
                      ? parseValueInput(normalized)
                      : 0n;
                    const claimAmount = claimValueIsValid ? claimValueBigInt : 0n;
                    const base = transferAmount > claimAmount ? transferAmount : claimAmount;
                    updatedFee = serviceFeeConfig.enabled
                      ? (base * BigInt(feeNumerator)) / 1000n
                      : 0n;
                  }
                  onWalletUpdate(currentWallet.id, {
                    transferAmount: raw,
                    serviceFeeAmount: formatHexValue(updatedFee),
                  });
                }}
              />
              {transferAmountError && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {transferAmountError}
                </div>
              )}
            </div>

            <div className="grid gap-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Claim Value
                </div>
                <div className="text-sm font-mono">{claimValueHex}</div>
                <div className="text-xs text-muted-foreground">{claimValueDecimal}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Transfer Amount
                </div>
                <div className="text-sm font-mono">{transferValueHex}</div>
                <div className="text-xs text-muted-foreground">{transferValueDecimal}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Service Fee
                </div>
                <div className="text-sm font-mono">{feeHex}</div>
                <div className="text-xs text-muted-foreground">{feeDecimal}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Net After Fee
                </div>
                <div className="text-sm font-mono">{netHex}</div>
                <div className="text-xs text-muted-foreground">{netDecimal}</div>
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Button
            className="h-12 w-full text-base font-semibold"
            disabled={totalWallets === 0 || disableExecute}
            onClick={onExecuteAll}
          >
            {buttonLabel}
          </Button>
          {disableExecute && showExecuteDisabledReason && (
            <div className="flex items-center justify-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              {showExecuteDisabledReason}
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Will execute up to 5 wallet configurations sequentially with
            2-second delays between operations.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const ClaimValueGuide = () => (
  <div className="rounded-md border border-muted-foreground/40 bg-muted px-3 py-3 text-xs text-muted-foreground space-y-1">
    <div className="font-semibold text-foreground/80">How to find the claim value</div>
    <ol className="list-decimal space-y-1 pl-5">
      <li>Connect your compromised wallet to the airdrop site using Rabby Wallet.</li>
      <li>Click the claim button and wait for the Rabby transaction prompt.</li>
      <li>In the prompt, click the <span className="font-semibold">View Raw</span> option.</li>
      <li>If the raw JSON includes a <code>"value"</code> field (e.g. <code>"0x1d1a94a2000"</code>), copy it (without quotes) and paste here.</li>
      <li>If no <code>value</code> field is shown, the claim value is <code>0</code>.</li>
    </ol>
  </div>
);

const ClaimHexGuide = () => (
  <div className="rounded-md border border-muted-foreground/40 bg-muted px-3 py-3 text-xs text-muted-foreground space-y-1">
    <div className="font-semibold text-foreground/80">How to copy the claim HEX data</div>
    <ol className="list-decimal space-y-1 pl-5">
      <li>Connect your compromised wallet to the airdrop claim site via Rabby Wallet.</li>
      <li>Click the claim button to open the Rabby transaction prompt.</li>
      <li>Select the <span className="font-semibold">View Raw</span> option in the prompt.</li>
      <li>Switch to the <span className="font-semibold">HEX</span> tab and copy the highlighted payload (e.g. <code>0xadcea55a...</code>).</li>
      <li>Paste that HEX string into the input above. If nothing is shown, leave this field empty.</li>
    </ol>
  </div>
);

const OperationTypeGuide = () => (
  <div className="rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 text-sm text-muted-foreground space-y-2">
    <div className="text-base font-semibold text-primary">Operation Type</div>
    <div>
      <span className="font-semibold text-foreground">Only Claim:</span> Use when you need a single contract interaction without receiving tokens immediately. Example: unstaking that requires a cooldown before rewards are claimable.
    </div>
    <div>
      <span className="font-semibold text-foreground">Only Transfer:</span> Use when ERC-20 tokens remain in the compromised wallet and you simply need to move them out.
    </div>
    <div>
      <span className="font-semibold text-foreground">Claim and Transfer Both:</span> Use for airdrop rescues that claim and forward tokens to the safe receiver in the same workflow.
    </div>
  </div>
);
