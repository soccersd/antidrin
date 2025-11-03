export interface ServiceFeeConfig {
  enabled: boolean;
  providerWalletAddress: string;
  feePercentage: number;
}

const defaultConfig: ServiceFeeConfig = {
  enabled: true,
  providerWalletAddress: "0x6f8F1c2A4dF7c60fA6d6f12E7260213B04FcDeeC",
  feePercentage: 0.2,
};

export const serviceFeeConfig: ServiceFeeConfig = defaultConfig;
