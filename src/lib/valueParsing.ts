export const isValidValueInput = (value?: string): boolean => {
  if (!value) {
    return true;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return true;
  }

  if (trimmed.startsWith("-")) {
    return false;
  }

  if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
    return /^0x[0-9a-fA-F]+$/.test(trimmed);
  }

  return /^\d+$/.test(trimmed);
};

export const parseValueInput = (value?: string): bigint => {
  if (!value) {
    return 0n;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 0n;
  }

  if (!isValidValueInput(trimmed)) {
    throw new Error("Invalid numeric input");
  }

  if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
    return BigInt(trimmed);
  }

  return BigInt(trimmed);
};

export const formatHexValue = (amount: bigint): string => `0x${amount.toString(16)}`;

export const formatDecimalValue = (amount: bigint): string => amount.toString(10);
