import { OrganizationPlan } from '@prisma/client';

export interface OrganizationRecord {
  id: string;
  name: string;
  plan: OrganizationPlan;
  status: string;
}

export interface IOrganizationRepository {
  findById(id: string): Promise<OrganizationRecord | null>;
  findFirstActive(): Promise<OrganizationRecord | null>;
}
