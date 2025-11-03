export interface ServiceFeeConfig {
  enabled: boolean;
  providerWalletAddress: string;
  feePercentage: number;
}

const defaultConfig: ServiceFeeConfig = {
  enabled: false,
  providerWalletAddress: "",
  feePercentage: 0.2,
};

export const serviceFeeConfig: ServiceFeeConfig = defaultConfig;
