import { ethers } from "ethers";

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  privateRpcUrl?: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const SUPPORTED_NETWORKS: Record<string, NetworkConfig> = {
  ethereum: {
    name: "Ethereum",
    chainId: 1,
    rpcUrl: "https://eth.llamarpc.com",
    privateRpcUrl: "https://rpc.flashbots.net/fast",
    blockExplorer: "https://etherscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  },
  bsc: {
    name: "Binance Smart Chain",
    chainId: 56,
    rpcUrl: "https://binance.llamarpc.com",
    blockExplorer: "https://bscscan.com",
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
    },
  },
  arbitrum: {
    name: "Arbitrum One",
    chainId: 42161,
    rpcUrl: "https://arbitrum.llamarpc.com",
    blockExplorer: "https://arbiscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  },
  base: {
    name: "Base",
    chainId: 8453,
    rpcUrl: "https://base.llamarpc.com",
    blockExplorer: "https://basescan.org",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  },
  polygon: {
    name: "Polygon",
    chainId: 137,
    rpcUrl: "https://polygon.llamarpc.com",
    blockExplorer: "https://polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
  },
};

export const getNetworkConfig = (networkKey: string): NetworkConfig | null => {
  return SUPPORTED_NETWORKS[networkKey] || null;
};

export const getProvider = (
  networkKey: string,
  usePrivate: boolean = false,
): ethers.JsonRpcProvider => {
  const config = getNetworkConfig(networkKey);
  if (!config) {
    throw new Error(`Network ${networkKey} not supported`);
  }

  const rpcUrl =
    usePrivate && config.privateRpcUrl ? config.privateRpcUrl : config.rpcUrl;
  return new ethers.JsonRpcProvider(rpcUrl);
};

export const switchNetwork = async (
  _provider: ethers.JsonRpcProvider,
  networkKey: string,
): Promise<void> => {
  const config = getNetworkConfig(networkKey);
  if (!config) {
    throw new Error(`Network ${networkKey} not supported`);
  }

  // Note: This would require wallet integration for browser environments
  // For server-side/standalone provider, you'd create a new instance
  console.log(`Switching to ${config.name} (Chain ID: ${config.chainId})`);
};

export const getBlockExplorerUrl = (
  networkKey: string,
  type: "tx" | "address",
  hash: string,
): string => {
  const config = getNetworkConfig(networkKey);
  if (!config) {
    return "#";
  }

  const baseUrl = config.blockExplorer;
  return type === "tx" ? `${baseUrl}/tx/${hash}` : `${baseUrl}/address/${hash}`;
};

export const formatNetworkName = (networkKey: string): string => {
  const config = getNetworkConfig(networkKey);
  return config ? config.name : networkKey;
};

export const getNativeCurrencySymbol = (networkKey: string): string => {
  const config = getNetworkConfig(networkKey);
  return config ? config.nativeCurrency.symbol : "ETH";
};

export const validateNetwork = (chainId: number): string | null => {
  for (const [key, config] of Object.entries(SUPPORTED_NETWORKS)) {
    if (config.chainId === chainId) {
      return key;
    }
  }
  return null;
};

export const getGasPrice = async (
  networkKey: string,
): Promise<{
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}> => {
  const provider = getProvider(networkKey);
  const feeData = await provider.getFeeData();

  return {
    gasPrice: feeData.gasPrice
      ? ethers.formatUnits(feeData.gasPrice, "gwei")
      : "0",
    maxFeePerGas: feeData.maxFeePerGas
      ? ethers.formatUnits(feeData.maxFeePerGas, "gwei")
      : "0",
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei")
      : "0",
  };
};

export const getNetworkStats = async (
  networkKey: string,
): Promise<{
  blockNumber: number;
  gasPrice: string;
}> => {
  const provider = getProvider(networkKey);
  const [blockNumber, feeData] = await Promise.all([
    provider.getBlockNumber(),
    provider.getFeeData(),
  ]);

  return {
    blockNumber,
    gasPrice: feeData.gasPrice
      ? ethers.formatUnits(feeData.gasPrice, "gwei")
      : "0",
  };
};

export const isPrivateMempoolSupported = (networkKey: string): boolean => {
  const config = getNetworkConfig(networkKey);
  return !!config?.privateRpcUrl;
};

export const getTransactionStatus = async (
  networkKey: string,
  txHash: string,
): Promise<{
  status: "pending" | "success" | "failed";
  blockNumber?: number;
  gasUsed?: string;
}> => {
  try {
    const provider = getProvider(networkKey);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return { status: "pending" };
    }

    return {
      status: receipt.status === 1 ? "success" : "failed",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
    };
  } catch (error) {
    console.error("Error getting transaction status:", error);
    return { status: "failed" };
  }
};

export const waitForTransaction = async (
  networkKey: string,
  txHash: string,
  confirmations: number = 1,
  timeout: number = 60000,
): Promise<ethers.TransactionReceipt | null> => {
  const provider = getProvider(networkKey);
  return await provider.waitForTransaction(txHash, confirmations, timeout);
};
