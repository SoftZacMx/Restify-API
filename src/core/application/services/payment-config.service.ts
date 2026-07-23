import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../domain/interfaces/branch-repository.interface';
import { PaymentConfig } from '../../domain/types/payment-config.types';
import { encrypt, decrypt } from '../../../shared/utils/crypto.util';
import { getBranchId } from '../../infrastructure/tenant/tenant-context';
import { AppError } from '../../../shared/errors';

@injectable()
export class PaymentConfigService {
  private cache: Map<string, PaymentConfig> = new Map();

  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository
  ) {}

  async get(): Promise<PaymentConfig> {
    const branchId = getBranchId();
    if (!branchId) return this.getFromEnv();

    if (this.cache.has(branchId)) return this.cache.get(branchId)!;

    const config = await this.loadBranchConfig(branchId);
    return config ?? this.getFromEnv();
  }

  /**
   * Config de cobro del comercio para procesar un pago REAL.
   *
   * A diferencia de get(), NUNCA cae al access token del .env: cada comercio cobra en su
   * propia cuenta de Mercado Pago, así que si el branch no la configuró, cobrar con la cuenta
   * de plataforma mandaría el dinero a la cuenta equivocada. Se falla en vez de eso.
   * Úsese al iniciar un cobro; get() sigue sirviendo para mostrar el estado en settings.
   */
  async getForCharging(): Promise<PaymentConfig> {
    const branchId = getBranchId();
    if (!branchId) {
      throw new AppError('MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED');
    }

    const config = this.cache.get(branchId) ?? await this.loadBranchConfig(branchId);
    if (!config?.mercadoPago.accessToken) {
      throw new AppError('MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED');
    }
    return config;
  }

  private async loadBranchConfig(branchId: string): Promise<PaymentConfig | null> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch?.paymentConfig) return null;

    const config = JSON.parse(decrypt(branch.paymentConfig)) as PaymentConfig;
    this.cache.set(branchId, config);
    return config;
  }

  async save(config: PaymentConfig): Promise<void> {
    const branchId = getBranchId();
    if (!branchId) throw new Error('Branch context not available');

    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new Error('Branch not found');

    const encrypted = encrypt(JSON.stringify(config));
    await this.branchRepository.update(branch.id, { paymentConfig: encrypted });
    this.cache.set(branchId, config);
  }

  clearCache(branchId?: string): void {
    if (branchId) {
      this.cache.delete(branchId);
    } else {
      this.cache.clear();
    }
  }

  private getFromEnv(): PaymentConfig {
    return {
      mercadoPago: {
        accessToken: process.env.MP_ACCESS_TOKEN || '',
        webhookSecret: process.env.MP_WEBHOOK_SECRET || '',
      },
    };
  }
}
