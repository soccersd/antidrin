import { ethers } from 'ethers';

export interface WalletData {
  address: string;
  privateKey: string;
  mnemonic?: string;
}

export interface SavedWallet {
  name: string;
  address: string;
  encryptedJson?: string;
  createdAt: number;
}

export const generateNewWallet = (): WalletData => {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase
  };
};

export const createWalletFromPrivateKey = (privateKey: string): WalletData => {
  const wallet = new ethers.Wallet(privateKey);
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
};

export const downloadWalletJSON = (wallet: WalletData, filename?: string) => {
  const walletData = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic,
    createdAt: new Date().toISOString(),
    warning: "This file contains sensitive private keys. Store it securely."
  };

  const blob = new Blob([JSON.stringify(walletData, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `wallet-${wallet.address.slice(0, 8)}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const validatePrivateKey = (privateKey: string): boolean => {
  try {
    new ethers.Wallet(privateKey);
    return true;
  } catch {
    return false;
  }
};

export const validateAddress = (address: string): boolean => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

export const getBalance = async (address: string, provider: ethers.JsonRpcProvider): Promise<string> => {
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error fetching balance:', error);
    return '0';
  }
};

export const estimateGas = async (
  from: string,
  to: string,
  data: string,
  provider: ethers.JsonRpcProvider
): Promise<string> => {
  try {
    const gasEstimate = await provider.estimateGas({
      from,
      to,
      data
    });
    return gasEstimate.toString();
  } catch (error) {
    console.error('Error estimating gas:', error);
    return '21000'; // Default gas limit
  }
};

export const sendTransaction = async (
  wallet: ethers.Wallet,
  to: string,
  value: string = '0',
  data: string = '0x',
  provider: ethers.JsonRpcProvider
): Promise<ethers.TransactionResponse> => {
  const connectedWallet = wallet.connect(provider);

  const tx = await connectedWallet.sendTransaction({
    to,
    value,
    data
  });

  return tx;
};
