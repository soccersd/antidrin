import { useMemo, useState } from "react";
import { Zap, Info, ChevronDown, ChevronUp } from "lucide-react";
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

const parseValueInput = (value: string): bigint => {
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

const formatHexValue = (amount: bigint): string => `0x${amount.toString(16)}`;
const formatDecimalValue = (amount: bigint): string => amount.toString(10);

interface OperationConfigurationCardProps {
  walletConfigs: WalletConfig[];
  selectedWalletId: string | null;
  onWalletUpdate: (id: string, updates: Partial<WalletConfig>) => void;
  onExecuteAll: () => void;
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

  const claimValueInput = currentWallet?.claimValue?.trim() ?? "";
  const feePercentage = serviceFeeConfig.feePercentage ?? 0.2;
  const feeNumerator = Math.round(feePercentage * 1000);

  const claimValueBigInt = useMemo(
    () => parseValueInput(claimValueInput),
    [claimValueInput],
  );
  const feeBigInt = useMemo(
    () => (claimValueBigInt * BigInt(feeNumerator)) / 1000n,
    [claimValueBigInt, feeNumerator],
  );
  const netBigInt = useMemo(
    () => (claimValueBigInt > feeBigInt ? claimValueBigInt - feeBigInt : 0n),
    [claimValueBigInt, feeBigInt],
  );

  const claimValueHex = useMemo(
    () => formatHexValue(claimValueBigInt),
    [claimValueBigInt],
  );
  const claimValueDecimal = useMemo(
    () => formatDecimalValue(claimValueBigInt),
    [claimValueBigInt],
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
                  const normalized = raw.trim().length === 0 ? "0" : raw.trim();
                  const parsed = parseValueInput(normalized);
                  const updatedFee = (parsed * BigInt(feeNumerator)) / 1000n;

                  onWalletUpdate(currentWallet.id, {
                    claimValue: raw,
                    serviceFeeAmount: formatHexValue(updatedFee),
                  });
                }}
              />
              {isClaimValueGuideOpen && <ClaimValueGuide />}
            </div>
          </>
        )}

        <div className="space-y-2">
          <Button
            className="h-12 w-full text-base font-semibold"
            disabled={totalWallets === 0}
            onClick={onExecuteAll}
          >
            {buttonLabel}
          </Button>
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
