import { inject, injectable } from 'tsyringe';
import { ICompanyRepository } from '../../domain/interfaces/company-repository.interface';
import { PaymentConfig } from '../../domain/types/payment-config.types';
import { encrypt, decrypt } from '../../../shared/utils/crypto.util';

@injectable()
export class PaymentConfigService {
  private cache: PaymentConfig | null = null;

  constructor(
    @inject('ICompanyRepository') private readonly companyRepository: ICompanyRepository
  ) {}

  async get(): Promise<PaymentConfig> {
    if (this.cache) return this.cache;

    const company = await this.companyRepository.findFirst();
    if (company?.paymentConfig) {
      const json = decrypt(company.paymentConfig);
      this.cache = JSON.parse(json) as PaymentConfig;
      return this.cache;
    }

    return this.getFromEnv();
  }

  async save(config: PaymentConfig): Promise<void> {
    const company = await this.companyRepository.findFirst();
    if (!company) throw new Error('Company not found');

    const encrypted = encrypt(JSON.stringify(config));
    await this.companyRepository.update(company.id, { paymentConfig: encrypted });
    this.cache = config;
  }

  clearCache(): void {
    this.cache = null;
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
