import { Company } from '../entities/company.entity';

export interface ICompanyRepository {
  findFirst(): Promise<Company | null>;
  create(data: {
    name: string;
    state: string;
    city: string;
    street: string;
    exteriorNumber: string;
    phone: string;
    rfc?: string | null;
    logoUrl?: string | null;
    startOperations?: string | null;
    endOperations?: string | null;
    ticketConfig?: unknown | null;
    paymentConfig?: string | null;
  }): Promise<Company>;
  update(
    id: string,
    data: {
      name?: string;
      state?: string;
      city?: string;
      street?: string;
      exteriorNumber?: string;
      phone?: string;
      rfc?: string | null;
      logoUrl?: string | null;
      startOperations?: string | null;
      endOperations?: string | null;
      ticketConfig?: unknown | null;
      paymentConfig?: string | null;
    }
  ): Promise<Company>;
}
