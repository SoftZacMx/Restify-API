import { inject, injectable } from 'tsyringe';
import { PrismaClient } from '@prisma/client';
import { BaseReportGenerator } from '../base-report.generator';
import { ReportType, BaseReportFilters, BaseReportResult } from '../../../domain/interfaces/report-generator.interface';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { PrismaService } from '../../../infrastructure/config/prisma.config';

export interface SalesPerformanceReportData {
  sales: Array<{
    menuItemId: string;
    menuItemName: string;
    unitPrice: number;
    quantitySold: number;
    totalSold: number;
    percentageOfTotal: number;
  }>;
  totalSold: number;
  summary: {
    totalMenuItems: number;
    averagePrice: number;
    topSeller: {
      menuItemId: string;
      menuItemName: string;
      totalSold: number;
    } | null;
  };
}

@injectable()
export class SalesPerformanceReportGenerator extends BaseReportGenerator {
  private prisma: PrismaClient;

  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject(PrismaService) private readonly prismaService: PrismaService
  ) {
    super();
    this.prisma = this.prismaService.getClient();
  }

  getType(): ReportType {
    return ReportType.SALES_PERFORMANCE;
  }

  protected async fetchData(filters: BaseReportFilters): Promise<any> {
    // Build date filter for Prisma
    const dateFilter: any = {};
    if (filters.dateFrom || filters.dateTo) {
      dateFilter.date = {};
      if (filters.dateFrom) dateFilter.date.gte = filters.dateFrom;
      if (filters.dateTo) dateFilter.date.lte = filters.dateTo;
    }

    // Fetch order items with menu items for the date range
    // Only include completed orders (status = true) and items that have menuItemId
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        menuItemId: { not: null },
        order: {
          status: true, // Only paid orders
          ...dateFilter,
        },
      },
      include: {
        menuItem: {
          include: {
            category: true,
          },
        },
        order: {
          select: {
            id: true,
            date: true,
            status: true,
          },
        },
      },
    });

    // Fetch all menu items to ensure we have complete data
    const allMenuItems = await this.menuItemRepository.findAll({ status: true });

    return {
      orderItems,
      allMenuItems,
    };
  }

  protected transformData(rawData: any, filters: BaseReportFilters): SalesPerformanceReportData {
    const { orderItems, allMenuItems } = rawData;

    // Group sales by menu item
    const salesMap = new Map<string, {
      menuItemId: string;
      menuItemName: string;
      unitPrice: number;
      quantitySold: number;
      totalSold: number;
    }>();

    // Process all order items with menu items
    orderItems.forEach((orderItem: any) => {
      if (!orderItem.menuItemId) return; // Skip items without menuItemId
      
      const menuItemId = orderItem.menuItemId;
      const menuItem = orderItem.menuItem;
      const quantity = orderItem.quantity;
      const unitPrice = Number(orderItem.price);
      const total = quantity * unitPrice;

      if (!salesMap.has(menuItemId)) {
        salesMap.set(menuItemId, {
          menuItemId,
          menuItemName: menuItem.name,
          unitPrice,
          quantitySold: 0,
          totalSold: 0,
        });
      }

      const existing = salesMap.get(menuItemId)!;
      existing.quantitySold += quantity;
      existing.totalSold += total;
    });

    // Convert map to array
    const sales = Array.from(salesMap.values());

    // Calculate total sold
    const totalSold = sales.reduce((sum, sale) => sum + sale.totalSold, 0);

    // Calculate percentage for each item
    const salesWithPercentage = sales.map((sale) => ({
      ...sale,
      percentageOfTotal: totalSold > 0 ? (sale.totalSold / totalSold) * 100 : 0,
    }));

    // Sort by total sold (descending)
    salesWithPercentage.sort((a, b) => b.totalSold - a.totalSold);

    // Find top seller
    const topSeller = salesWithPercentage.length > 0
      ? {
          menuItemId: salesWithPercentage[0].menuItemId,
          menuItemName: salesWithPercentage[0].menuItemName,
          totalSold: salesWithPercentage[0].totalSold,
        }
      : null;

    // Calculate average price
    const averagePrice = salesWithPercentage.length > 0
      ? salesWithPercentage.reduce((sum, sale) => sum + sale.unitPrice, 0) / salesWithPercentage.length
      : 0;

    return {
      sales: salesWithPercentage,
      totalSold,
      summary: {
        totalMenuItems: salesWithPercentage.length,
        averagePrice,
        topSeller,
      },
    };
  }
}

