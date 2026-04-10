export interface MercadoPagoConfig {
  accessToken: string;
  webhookSecret: string;
}

export interface PaymentConfig {
  mercadoPago: MercadoPagoConfig;
}

export interface MaskedPaymentConfig {
  mercadoPago: {
    accessToken: string;
    webhookSecret: string;
  };
  isConfigured: boolean;
}

export interface SavePaymentConfigInput {
  mercadoPago?: {
    accessToken?: string;
    webhookSecret?: string;
  };
}
