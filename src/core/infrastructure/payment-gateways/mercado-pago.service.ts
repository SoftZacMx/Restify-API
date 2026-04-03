import { MercadoPagoConfig, Preference, Payment as PaymentMP } from 'mercadopago';
import { injectable } from 'tsyringe';
import { createHmac } from 'crypto';

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
}

export interface ValidateWebhookParams {
  xSignature: string;
  xRequestId: string;
  dataId: string;
}

// --- Service ---

@injectable()
export class MercadoPagoService {
  private client: MercadoPagoConfig;
  private preference: Preference;
  private paymentClient: PaymentMP;

  constructor() {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('MP_ACCESS_TOKEN environment variable is required');
    }
    this.client = new MercadoPagoConfig({ accessToken });
    this.preference = new Preference(this.client);
    this.paymentClient = new PaymentMP(this.client);
  }

  async createPreference(params: CreateMPPreferenceParams): Promise<MPPreferenceResult> {
    const preference = await this.preference.create({
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
          success: `${process.env.MP_BACK_URL || 'https://restify.app'}/payment/success`,
          failure: `${process.env.MP_BACK_URL || 'https://restify.app'}/payment/failure?status=failure`,
          pending: `${process.env.MP_BACK_URL || 'https://restify.app'}/payment/pending?status=pending`,
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
    const preference = await this.preference.get({ preferenceId });

    return {
      id: preference.id!,
      initPoint: preference.init_point!,
      sandboxInitPoint: preference.sandbox_init_point!,
      expirationDate: preference.expiration_date_to || null,
    };
  }

  async getPayment(paymentId: string): Promise<MPPaymentResult> {
    const payment = await this.paymentClient.get({ id: paymentId });

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
    };
  }

  validateWebhookSignature(params: ValidateWebhookParams): boolean {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('MP_WEBHOOK_SECRET environment variable is required');
    }

    // TODO: Remover log de debug
    console.log('[MP Signature] secret (first 10):', secret.substring(0, 10));

    const { xSignature, xRequestId, dataId } = params;

    // Parsear x-signature: "ts=xxx,v1=xxx"
    const parts = xSignature.split(',');
    const tsEntry = parts.find((p) => p.trim().startsWith('ts='));
    const v1Entry = parts.find((p) => p.trim().startsWith('v1='));

    if (!tsEntry || !v1Entry) {
      return false;
    }

    const ts = tsEntry.split('=')[1];
    const v1 = v1Entry.split('=')[1];

    // Construir el manifest según la documentación de MP
    // Si un valor no está presente, se omite del manifest
    let manifest = '';
    if (dataId) manifest += `id:${dataId};`;
    manifest += `request-id:${xRequestId};ts:${ts};`;

    const hmac = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    // TODO: Remover log de debug
    console.log('[MP Signature] manifest:', manifest);
    console.log('[MP Signature] hmac:', hmac);
    console.log('[MP Signature] v1:', v1);
    console.log('[MP Signature] match:', hmac === v1);

    return hmac === v1;
  }
}
