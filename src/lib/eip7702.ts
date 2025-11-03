import { ethers, Signer } from 'ethers';

export interface DelegationRequest {
  delegator: string;
  delegatee: string;
  authority: string;
  expiry: number;
  nonce: number;
  functions: string[];
}

export interface DelegationSignature {
  request: DelegationRequest;
  signature: string;
}

export const EIP7702_DOMAIN = {
  name: 'EIP7702Delegation',
  version: '1',
  chainId: 1, // Will be updated based on network
  verifyingContract: ethers.ZeroAddress, // Using zero address for now
};

export const DELEGATION_TYPES = {
  DELEGATE: 0,
  REVOKE: 1,
};

export const FUNCTION_SIGNATURES = {
  CLAIM: 'claim()',
  TRANSFER: 'transfer(address,uint256)',
  BALANCE_OF: 'balanceOf(address)',
  ALLOWANCE: 'allowance(address,address)',
  APPROVE: 'approve(address,uint256)',
  SAFE_TRANSFER: 'safeTransfer(address,uint256)',
};

export const createDelegationRequest = (
  delegator: string,
  delegatee: string,
  authority: string,
  expiry: number,
  nonce: number,
  functions: string[] = [FUNCTION_SIGNATURES.CLAIM, FUNCTION_SIGNATURES.TRANSFER]
): DelegationRequest => {
  return {
    delegator,
    delegatee,
    authority,
    expiry,
    nonce,
    functions,
  };
};

export const hashDelegationRequest = (request: DelegationRequest): string => {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'address', 'uint256', 'uint256', 'string[]'],
      [
        request.delegator,
        request.delegatee,
        request.authority,
        request.expiry,
        request.nonce,
        request.functions
      ]
    )
  );
};

export const signDelegation = async (
  signer: Signer,
  request: DelegationRequest,
  chainId: number
): Promise<string> => {
  const domain = {
    ...EIP7702_DOMAIN,
    chainId,
  };

  const types = {
    Delegation: [
      { name: 'delegator', type: 'address' },
      { name: 'delegatee', type: 'address' },
      { name: 'authority', type: 'address' },
      { name: 'expiry', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'functions', type: 'string[]' },
    ],
  };

  const value = {
    delegator: request.delegator,
    delegatee: request.delegatee,
    authority: request.authority,
    expiry: request.expiry,
    nonce: request.nonce,
    functions: request.functions,
  };

  const signature = await signer.signTypedData(domain, types, value);
  return signature;
};

export const verifyDelegation = (
  request: DelegationRequest,
  signature: string,
  chainId: number
): string => {
  const domain = {
    ...EIP7702_DOMAIN,
    chainId,
  };

  const types = {
    Delegation: [
      { name: 'delegator', type: 'address' },
      { name: 'delegatee', type: 'address' },
      { name: 'authority', type: 'address' },
      { name: 'expiry', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'functions', type: 'string[]' },
    ],
  };

  const value = {
    delegator: request.delegator,
    delegatee: request.delegatee,
    authority: request.authority,
    expiry: request.expiry,
    nonce: request.nonce,
    functions: request.functions,
  };

  return ethers.verifyTypedData(domain, types, value, signature);
};

export const isDelegationValid = (request: DelegationRequest): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return request.expiry > now;
};

export const createRevokeDelegation = (
  delegator: string,
  delegatee: string,
  authority: string,
  nonce: number
): DelegationRequest => {
  return createDelegationRequest(
    delegator,
    delegatee,
    authority,
    0, // Immediate expiry for revocation
    nonce,
    [] // No functions allowed
  );
};

export const encodeDelegationCall = (
  delegationSignature: DelegationSignature
): string => {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // This would be the interface for the batch contract's delegate function
  const encoded = abiCoder.encode(
    ['(address,address,address,uint256,uint256,string[],bytes)'],
    [[
      delegationSignature.request.delegator,
      delegationSignature.request.delegatee,
      delegationSignature.request.authority,
      delegationSignature.request.expiry,
      delegationSignature.request.nonce,
      delegationSignature.request.functions,
      delegationSignature.signature
    ]]
  );

  return encoded;
};

export const decodeDelegationCall = (data: string): DelegationSignature => {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const decoded = abiCoder.decode(
    ['(address,address,address,uint256,uint256,string[],bytes)'],
    data
  )[0];

  return {
    request: {
      delegator: decoded[0],
      delegatee: decoded[1],
      authority: decoded[2],
      expiry: Number(decoded[3]),
      nonce: Number(decoded[4]),
      functions: decoded[5],
    },
    signature: decoded[6],
  };
};

// Helper function to get a nonce for delegation
export const getNextNonce = (delegatorAddress: string): number => {
  const nonceKey = `delegation_nonce_${delegatorAddress}`;
  const currentNonce = localStorage.getItem(nonceKey);
  const nextNonce = currentNonce ? parseInt(currentNonce) + 1 : 1;
  localStorage.setItem(nonceKey, nextNonce.toString());
  return nextNonce;
};

// Helper function to get function selector from signature
export const getFunctionSelector = (functionSignature: string): string => {
  return ethers.keccak256(ethers.toUtf8Bytes(functionSignature)).slice(0, 10);
};

// Helper to validate if a function is allowed in delegation
export const isFunctionAllowed = (functionSignature: string, allowedFunctions: string[]): boolean => {
  const selector = getFunctionSelector(functionSignature);
  return allowedFunctions.some(allowedFunc => {
    const allowedSelector = getFunctionSelector(allowedFunc);
    return selector === allowedSelector;
  });
};
