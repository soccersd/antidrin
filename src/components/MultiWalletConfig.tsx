import { Plus, Copy, Globe, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

export interface WalletConfig {
  id: string;
  name: string;
  network: string;
  privateKey: string;
  operationType: "claim" | "transfer" | "both";
  airdropContract: string;
  tokenContract?: string;
  claimData: string;
  receiverAddress: string;
  claimValue?: string;
  serviceFeeAmount?: string;
  delegated: boolean;
  balance?: string;
}

interface MultiWalletConfigProps {
  configs: WalletConfig[];
  selectedWalletId: string | null;
  onConfigsChange: (configs: WalletConfig[]) => void;
  onSelectWallet: (id: string | null) => void;
}

const MAX_WALLETS = 5;

const NETWORK_OPTIONS = [
  { value: "ethereum", label: "Ethereum Mainnet" },
  { value: "bsc", label: "BSC" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "base", label: "Base" },
  { value: "polygon", label: "Polygon" },
];

const DEFAULT_WALLET_CONFIG: Omit<WalletConfig, "id" | "delegated"> = {
  name: "",
  network: "ethereum",
  privateKey: "",
  operationType: "both",
  airdropContract: "",
  tokenContract: "",
  claimData: "",
  receiverAddress: "",
  claimValue: "",
  serviceFeeAmount: "0x0",
};

export default function MultiWalletConfig({
  configs,
  selectedWalletId,
  onConfigsChange,
  onSelectWallet,
}: MultiWalletConfigProps) {

  const addWallet = () => {
    if (configs.length >= MAX_WALLETS) {
      alert(`Maximum ${MAX_WALLETS} wallets allowed`);
      return;
    }
    const newConfig: WalletConfig = {
      ...DEFAULT_WALLET_CONFIG,
      id: Date.now().toString(),
      delegated: false,
      name: `Wallet ${configs.length + 1}`,
    };
    onConfigsChange([...configs, newConfig]);
    onSelectWallet(newConfig.id);
  };

  const removeWallet = (id: string) => {
    const remaining = configs.filter((config) => config.id !== id);
    onConfigsChange(remaining);
    if (selectedWalletId === id) {
      onSelectWallet(remaining[0]?.id ?? null);
    }
  };

  const duplicateWallet = (config: WalletConfig) => {
    if (configs.length >= MAX_WALLETS) {
      alert(`Maximum ${MAX_WALLETS} wallets allowed`);
      return;
    }
    const copy = {
      ...config,
      id: `${Date.now()}-copy`,
      name: `${config.name || "Wallet"} Copy`,
      delegated: false,
    };
    onConfigsChange([...configs, copy]);
    onSelectWallet(copy.id);
  };

  const updateWallet = (id: string, updates: Partial<WalletConfig>) => {
    onConfigsChange(
      configs.map((config) =>
        config.id === id ? { ...config, ...updates } : config,
      ),
    );
  };

  const currentConfig = configs.find((config) => config.id === selectedWalletId);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-5 w-5 text-primary" />
            Multi-Wallet Config
          </CardTitle>
          <CardDescription>
            Select a wallet profile and define its basic network settings.
          </CardDescription>
        </div>
        <Button
          onClick={addWallet}
          disabled={configs.length >= MAX_WALLETS}
          className="rounded-full bg-primary px-4 font-semibold text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Wallet
        </Button>
      </CardHeader>
      <CardContent>
        {configs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-6 py-10 text-center text-muted-foreground">
            Create your first wallet configuration to get started.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-muted-foreground">
                Select Wallet Configuration
              </Label>
              <div className="flex flex-wrap gap-2">
                {configs.map((config, index) => {
                  const isActive = config.id === currentConfig?.id;
                  return (
                    <div
                      key={config.id}
                      className="flex items-center gap-1 rounded-full bg-muted px-1 py-1"
                    >
                      <Button
                        type="button"
                        onClick={() => onSelectWallet(config.id)}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-transparent text-muted-foreground hover:bg-primary/20",
                        )}
                      >
                        Wallet {index + 1}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => duplicateWallet(config)}
                        title="Duplicate wallet configuration"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => removeWallet(config.id)}
                        title="Remove wallet configuration"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {currentConfig && (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wallet-name">Wallet Name</Label>
                  <Input
                    id="wallet-name"
                    placeholder="Wallet name"
                    value={currentConfig.name}
                    onChange={(e) =>
                      updateWallet(currentConfig.id, { name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet-network">Select Network</Label>
                  <Select
                    value={currentConfig.network}
                    onValueChange={(value) =>
                      updateWallet(currentConfig.id, { network: value })
                    }
                  >
                    <SelectTrigger id="wallet-network">
                      <SelectValue placeholder="Select a network" />
                    </SelectTrigger>
                    <SelectContent>
                      {NETWORK_OPTIONS.map((network) => (
                        <SelectItem key={network.value} value={network.value}>
                          {network.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
