import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../domain/interfaces/branch-repository.interface';
import { PaymentConfig } from '../../domain/types/payment-config.types';
import { encrypt, decrypt } from '../../../shared/utils/crypto.util';
import { getBranchId } from '../../infrastructure/tenant/tenant-context';

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

    const branch = await this.branchRepository.findById(branchId);
    if (branch?.paymentConfig) {
      const json = decrypt(branch.paymentConfig);
      const config = JSON.parse(json) as PaymentConfig;
      this.cache.set(branchId, config);
      return config;
    }

    return this.getFromEnv();
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
