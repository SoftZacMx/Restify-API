import { MercadoPagoConfig, Preference, Payment as PaymentMP } from 'mercadopago';
import { inject, injectable } from 'tsyringe';
import { createHmac } from 'crypto';
import { PaymentConfigService } from '../../application/services/payment-config.service';
import { AppError } from '../../../shared/errors';

// --- Interfaces ---

export interface CreateMPPreferenceParams {
  orderId: string;
  title: string;
  description?: string;
  amount: number; // Total en MXN (decimales, no centavos)
  currency: string;
  metadata: {
    orderId: string;
    paymentId: string;
    companyId?: string;
  };
  notificationUrl: string;
  expirationDate?: string; // ISO date
}

export interface MPPreferenceResult {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
  expirationDate: string | null;
}

export interface MPFeeDetail {
  type: string;     // ej. "mercadopago_fee", "financing_fee", "shipping_fee"
  amount: number;   // monto absoluto en la moneda del pago
  feePayer?: string; // "collector" cuando lo paga el negocio
}

export interface MPPaymentResult {
  id: number;
  status: string;
  statusDetail: string;
  externalReference: string;
  transactionAmount: number;
  currencyId: string;
  paymentMethodId: string;
  paymentTypeId: string;
  dateApproved: string | null;
  feeDetails: MPFeeDetail[];
}

export interface ValidateWebhookParams {
  xSignature: string;
  xRequestId: string;
  dataId: string;
}

// --- Service ---

@injectable()
export class MercadoPagoService {
  private client: MercadoPagoConfig | null = null;
  private preference: Preference | null = null;
  private paymentClient: PaymentMP | null = null;

  constructor(
    @inject(PaymentConfigService) private readonly paymentConfigService: PaymentConfigService
  ) {}

  private async initClient(): Promise<void> {
    if (this.client) return;
    const config = await this.paymentConfigService.get();
    if (!config.mercadoPago.accessToken) {
      throw new AppError('PAYMENT_CONFIG_NOT_CONFIGURED', 'Mercado Pago access token no configurado');
    }
    this.client = new MercadoPagoConfig({ accessToken: config.mercadoPago.accessToken });
    this.preference = new Preference(this.client);
    this.paymentClient = new PaymentMP(this.client);
  }

  async createPreference(params: CreateMPPreferenceParams): Promise<MPPreferenceResult> {
    await this.initClient();
    const backUrl = process.env.MP_BACK_URL || 'https://restify.app';

    const preference = await this.preference!.create({
      body: {
        items: [
          {
            id: params.orderId,
            title: params.title,
            description: params.description || '',
            quantity: 1,
            unit_price: params.amount,
            currency_id: params.currency,
          },
        ],
        metadata: params.metadata,
        external_reference: params.orderId,
        notification_url: params.notificationUrl,
        back_urls: {
          success: `${backUrl}/payment/success`,
          failure: `${backUrl}/payment/failure?status=failure`,
          pending: `${backUrl}/payment/pending?status=pending`,
        },
        auto_return: 'approved',
        expires: true,
        expiration_date_to: params.expirationDate,
        payment_methods: {
          excluded_payment_types: [
            { id: 'ticket' },
          ],
          installments: 1,
        },
      },
    });

    return {
      id: preference.id!,
      initPoint: preference.init_point!,
      sandboxInitPoint: preference.sandbox_init_point!,
      expirationDate: preference.expiration_date_to || null,
    };
  }

  async getPreference(preferenceId: string): Promise<MPPreferenceResult> {
    await this.initClient();
    const preference = await this.preference!.get({ preferenceId });

    return {
      id: preference.id!,
      initPoint: preference.init_point!,
      sandboxInitPoint: preference.sandbox_init_point!,
      expirationDate: preference.expiration_date_to || null,
    };
  }

  async getPayment(paymentId: string): Promise<MPPaymentResult> {
    await this.initClient();
    const payment = await this.paymentClient!.get({ id: paymentId });

    const rawFees = (payment as { fee_details?: Array<{ type?: string; amount?: number; fee_payer?: string }> }).fee_details ?? [];
    const feeDetails: MPFeeDetail[] = rawFees
      .filter((f) => typeof f.amount === 'number' && f.amount > 0)
      .map((f) => ({
        type: f.type ?? 'unknown',
        amount: f.amount as number,
        feePayer: f.fee_payer,
      }));

    return {
      id: payment.id!,
      status: payment.status!,
      statusDetail: payment.status_detail!,
      externalReference: payment.external_reference!,
      transactionAmount: payment.transaction_amount!,
      currencyId: payment.currency_id!,
      paymentMethodId: payment.payment_method_id!,
      paymentTypeId: payment.payment_type_id!,
      dateApproved: payment.date_approved || null,
      feeDetails,
    };
  }

  async validateWebhookSignature(params: ValidateWebhookParams): Promise<boolean> {
    const config = await this.paymentConfigService.get();
    const secret = config.mercadoPago.webhookSecret;
    if (!secret) {
      throw new AppError('PAYMENT_CONFIG_NOT_CONFIGURED', 'Mercado Pago webhook secret no configurado');
    }

    const { xSignature, xRequestId, dataId } = params;

    const parts = xSignature.split(',');
    const tsEntry = parts.find((p) => p.trim().startsWith('ts='));
    const v1Entry = parts.find((p) => p.trim().startsWith('v1='));

    if (!tsEntry || !v1Entry) {
      return false;
    }

    const ts = tsEntry.split('=')[1];
    const v1 = v1Entry.split('=')[1];

    let manifest = '';
    if (dataId) manifest += `id:${dataId};`;
    manifest += `request-id:${xRequestId};ts:${ts};`;

    const hmac = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    return hmac === v1;
  }
}
