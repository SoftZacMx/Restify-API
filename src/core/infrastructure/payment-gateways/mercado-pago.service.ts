import { MercadoPagoConfig, Preference, Payment as PaymentMP } from 'mercadopago';
import { inject, injectable } from 'tsyringe';
import { createHmac } from 'crypto';
import { PaymentConfigService } from '../../application/services/payment-config.service';
import { AppError } from '../../../shared/errors';
import { getBranchId } from '../tenant/tenant-context';

// --- Interfaces ---

export interface CreateMPPreferenceParams {
  orderId: string;
  branchId?: string;
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

interface MPClients {
  preference: Preference;
  payment: PaymentMP;
}

// Key para el cache de clientes cuando no hay tenant context (config desde env)
const ENV_CLIENT_KEY = '__env__';

@injectable()
export class MercadoPagoService {
  // Un cliente por branch: cada branch puede tener su propia cuenta de MP.
  private clients: Map<string, MPClients> = new Map();

  constructor(
    @inject(PaymentConfigService) private readonly paymentConfigService: PaymentConfigService
  ) {}

  private async getClients(): Promise<MPClients> {
    const key = getBranchId() ?? ENV_CLIENT_KEY;
    const cached = this.clients.get(key);
    if (cached) return cached;

    const config = await this.paymentConfigService.get();
    if (!config.mercadoPago.accessToken) {
      throw new AppError('PAYMENT_CONFIG_NOT_CONFIGURED', 'Mercado Pago access token no configurado');
    }
    const client = new MercadoPagoConfig({ accessToken: config.mercadoPago.accessToken });
    const clients: MPClients = {
      preference: new Preference(client),
      payment: new PaymentMP(client),
    };
    this.clients.set(key, clients);
    return clients;
  }

  clearClient(branchId?: string): void {
    if (branchId) {
      this.clients.delete(branchId);
    } else {
      this.clients.clear();
    }
  }

  async createPreference(params: CreateMPPreferenceParams): Promise<MPPreferenceResult> {
    const { preference: preferenceClient } = await this.getClients();
    const backUrl = process.env.MP_BACK_URL || 'https://restify.app';

    const preference = await preferenceClient.create({
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
        external_reference: params.branchId
          ? `${params.orderId}:${params.branchId}`
          : params.orderId,
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
    const { preference: preferenceClient } = await this.getClients();
    const preference = await preferenceClient.get({ preferenceId });

    return {
      id: preference.id!,
      initPoint: preference.init_point!,
      sandboxInitPoint: preference.sandbox_init_point!,
      expirationDate: preference.expiration_date_to || null,
    };
  }

  async getPayment(paymentId: string): Promise<MPPaymentResult> {
    const { payment: paymentClient } = await this.getClients();
    const payment = await paymentClient.get({ id: paymentId });

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
