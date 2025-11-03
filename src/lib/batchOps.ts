import { ethers, Wallet, JsonRpcProvider } from "ethers";
import type { DelegationSignature } from "./eip7702";
import { encodeDelegationCall } from "./eip7702";
import { getBlockExplorerUrl } from "./rpc";
const parseValue = (raw?: string): bigint => {
  if (!raw) return 0n;
  const trimmed = raw.trim();
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

export { getBlockExplorerUrl };

export interface BatchOperation {
  walletAddress: string;
  delegateeAddress: string;
  airdropContract: string;
  tokenContract?: string;
  receiverAddress: string;
  claimData: string;
  claimValue?: string;
  transferAmount?: string;
  serviceFeeAmount?: string;
  delegationSignature: DelegationSignature;
}

export interface BatchResult {
  walletAddress: string;
  status: "pending" | "success" | "error";
  transactionHash?: string;
  error?: string;
  timestamp: Date;
}

export interface BatchExecutionLog {
  id: string;
  batchId: string;
  operation: BatchOperation;
  result: BatchResult;
  gasUsed?: string;
  actualFee?: string;
}

// Flashbots RPC endpoints
const FLASHBOTS_RPC_URLS = {
  ethereum: "https://rpc.flashbots.net/fast",
  ethereumMainnet: "https://rpc.flashbots.net",
  // Alternative private relays for MEV protection
  bloxroute: "https://bloxroute.blxrbdn.com",
  bloxrouteTestnet: "https://testnet.blxrbdn.com",
};

// Standard RPC endpoints (fallback)
const STANDARD_RPC_URLS = {
  ethereum: "https://eth.llamarpc.com",
  bsc: "https://binance.llamarpc.com",
  arbitrum: "https://arbitrum.llamarpc.com",
  base: "https://base.llamarpc.com",
  polygon: "https://polygon.llamarpc.com",
};

export const getProvider = (
  network: string,
  usePrivate: boolean = false,
): JsonRpcProvider => {
  const rpcUrl =
    usePrivate && FLASHBOTS_RPC_URLS[network as keyof typeof FLASHBOTS_RPC_URLS]
      ? FLASHBOTS_RPC_URLS[network as keyof typeof FLASHBOTS_RPC_URLS]
      : STANDARD_RPC_URLS[network as keyof typeof STANDARD_RPC_URLS] ||
        STANDARD_RPC_URLS.ethereum;

  return new ethers.JsonRpcProvider(rpcUrl);
};

export const createClaimTransaction = (
  operation: BatchOperation,
): ethers.TransactionRequest => {
  const claimInterface = new ethers.Interface([
    "function claim(bytes calldata data) external",
    "function transfer(address to, uint256 amount) external",
  ]);

  const claimCalldata = claimInterface.encodeFunctionData("claim", [
    operation.claimData,
  ]);

  let transferCalldata = "0x";
  if (operation.tokenContract && operation.transferAmount && operation.transferAmount !== "0") {
    transferCalldata = claimInterface.encodeFunctionData("transfer", [
      operation.receiverAddress,
      operation.transferAmount,
    ]);
  }

  const batchInterface = new ethers.Interface([
    "function executeDelegatedOperations((address,address,address,address,string,bytes,bytes)[] calldata operations) external",
    "function delegate(address delegator, address authority, uint256 expiry, uint256 nonce, string[] memory functions, bytes memory signature) external",
  ]);

  const delegationCalldata = encodeDelegationCall(
    operation.delegationSignature,
  );

  const batchOperation = [
    operation.walletAddress,
    operation.delegateeAddress,
    operation.airdropContract,
    operation.tokenContract || ethers.ZeroAddress,
    operation.receiverAddress,
    claimCalldata,
    transferCalldata,
    delegationCalldata,
  ];

  const batchCallData = batchInterface.encodeFunctionData(
    "executeDelegatedOperations",
    [[batchOperation]],
  );

  const tx: ethers.TransactionRequest = {
    to: operation.delegateeAddress,
    data: batchCallData,
    gasLimit: "300000",
  };

  const value = parseValue(operation.claimValue);
  if (value > 0n) {
    tx.value = value;
  }

  return tx;
};

export const executeBatchOperations = async (
  operations: BatchOperation[],
  sponsorWallet: Wallet,
  network: string,
  onProgress?: (index: number, result: BatchResult) => void,
  usePrivate: boolean = false,
): Promise<BatchResult[]> => {
  const results: BatchResult[] = [];
  const provider = getProvider(network, usePrivate);
  const connectedWallet = sponsorWallet.connect(provider);

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    let result: BatchResult;

    try {
      console.log(`Executing operation for wallet: ${operation.walletAddress}`);

      const txRequest = createClaimTransaction(operation);

      // Add delay between operations to avoid nonce conflicts
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const tx = await connectedWallet.sendTransaction(txRequest);
      console.log(`Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(
        `Transaction confirmed: ${tx.hash}, gas used: ${receipt?.gasUsed.toString()}`,
      );

      result = {
        walletAddress: operation.walletAddress,
        status: receipt?.status === 1 ? "success" : "error",
        transactionHash: tx.hash,
        timestamp: new Date(),
        error: receipt?.status !== 1 ? "Transaction failed" : undefined,
      };
    } catch (error) {
      console.error(
        `Error executing operation for ${operation.walletAddress}:`,
        error,
      );
      result = {
        walletAddress: operation.walletAddress,
        status: "error",
        timestamp: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    results.push(result);

    if (onProgress) {
      onProgress(i, result);
    }
  }

  return results;
};

export const estimateBatchGas = async (
  operations: BatchOperation[],
  sponsorWallet: Wallet,
  network: string,
  usePrivate: boolean = false,
): Promise<{ totalGas: string; totalFee: string }> => {
  const provider = getProvider(network, usePrivate);

  let totalGas = 0n;

  for (const operation of operations) {
    try {
      const txRequest = createClaimTransaction(operation);
      const gasEstimate = await provider.estimateGas({
        ...txRequest,
        from: sponsorWallet.address,
      });
      totalGas += gasEstimate;
    } catch (error) {
      console.error("Gas estimation failed:", error);
      // Add default gas limit for failed estimation
      totalGas += 300000n;
    }
  }

  const gasPrice = await provider.getFeeData();
  const maxFeePerGas =
    gasPrice.maxFeePerGas ||
    gasPrice.gasPrice ||
    ethers.parseUnits("20", "gwei");

  const totalFee = totalGas * maxFeePerGas;

  return {
    totalGas: totalGas.toString(),
    totalFee: ethers.formatEther(totalFee),
  };
};

export const withdrawSponsorFunds = async (
  sponsorWallet: Wallet,
  toAddress: string,
  network: string,
  amount?: string,
): Promise<ethers.TransactionResponse> => {
  const provider = getProvider(network);
  const connectedWallet = sponsorWallet.connect(provider);

  let value = "0";
  if (amount) {
    value = ethers.parseEther(amount).toString();
  } else {
    // Withdraw all funds
    const balance = await provider.getBalance(sponsorWallet.address);
    const gasPrice = await provider.getFeeData();
    const gasLimit = 21000n; // Standard ETH transfer gas limit
    const maxFeePerGas =
      gasPrice.maxFeePerGas ||
      gasPrice.gasPrice ||
      ethers.parseUnits("20", "gwei");
    const gasFee = gasLimit * maxFeePerGas;

    value = (balance - gasFee).toString();
  }

  const tx = await connectedWallet.sendTransaction({
    to: toAddress,
    value,
  });

  return tx;
};

export const getWalletBalance = async (
  address: string,
  network: string,
  tokenAddress?: string,
): Promise<string> => {
  const provider = getProvider(network);

  if (!tokenAddress) {
    // Native token balance
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } else {
    // ERC20 token balance
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ["function balanceOf(address) view returns (uint256)"],
      provider,
    );

    const balance = await tokenContract.balanceOf(address);
    // Assuming 18 decimals, adjust as needed
    return ethers.formatUnits(balance, 18);
  }
};

export const createFlashbotsBundle = (
  operations: BatchOperation[],
  sponsorWallet: Wallet,
): ethers.TransactionRequest[] => {
  const bundle: ethers.TransactionRequest[] = [];

  for (const operation of operations) {
    const txRequest = createClaimTransaction(operation);
    txRequest.from = sponsorWallet.address;
    bundle.push(txRequest);
  }

  return bundle;
};

export const submitFlashbotsBundle = async (
  bundle: ethers.TransactionRequest[],
  targetBlockNumber?: number,
): Promise<{ bundleHash: string }> => {
  // This is a simplified version. In production, you'd use the Flashbots SDK
  // or interact directly with the Flashbots relay API
  try {
    const response = await fetch("https://relay.flashbots.net", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendBundle",
        params: [
          {
            txs: bundle.map((tx) => tx.data || "0x"),
            blockNumber: `0x${(targetBlockNumber || "latest").toString(16)}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return {
      bundleHash: data.result,
    };
  } catch (error) {
    console.error("Flashbots bundle submission failed:", error);
    throw error;
  }
};
