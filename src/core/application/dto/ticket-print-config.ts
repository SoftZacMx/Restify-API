/**
 * Configuración de impresión de tickets (almacenada en Company.ticketConfig, JSON).
 * mergeTicketPrintConfig() aplica valores por defecto sobre lo guardado en BDD.
 */

export interface TicketPrintLayout {
  paperWidthMm: number;
  bodyPaddingVerticalMm: number;
  bodyPaddingHorizontalMm: number;
  baseFontPt: number;
  itemBlockMarginBottomPx: number;
  itemBlockPaddingBottomPx: number;
}

export interface TicketPrintSaleConfig {
  showBrandBranch: boolean;
  showContact: boolean;
  showContactRfc: boolean;
  showContactAddress: boolean;
  showContactPhone: boolean;
  showTicketTitle: boolean;
  showOrderId: boolean;
  showDateTime: boolean;
  showTableLine: boolean;
  showConsumoHeader: boolean;
  showItemQuantity: boolean;
  showItemExtras: boolean;
  showLinePrice: boolean;
  showItemNote: boolean;
  showSubtotal: boolean;
  showIva: boolean;
  showTip: boolean;
  showTotal: boolean;
  showPaymentMethod: boolean;
  showDeliveredStatus: boolean;
  showFooter: boolean;
  footerText: string;
  centerTotalsBlock: boolean;
}

export interface TicketPrintKitchenConfig {
  showBrandBranch: boolean;
  showOrderId: boolean;
  showTableLine: boolean;
  showPedidoHeader: boolean;
  showItemQuantity: boolean;
  showItemExtras: boolean;
  showItemNote: boolean;
}

export interface ResolvedTicketPrintConfig {
  schemaVersion: 1;
  layout: TicketPrintLayout;
  sale: TicketPrintSaleConfig;
  kitchen: TicketPrintKitchenConfig;
}

export const DEFAULT_TICKET_PRINT_CONFIG: ResolvedTicketPrintConfig = {
  schemaVersion: 1,
  layout: {
    paperWidthMm: 58,
    bodyPaddingVerticalMm: 1,
    bodyPaddingHorizontalMm: 1,
    baseFontPt: 13,
    itemBlockMarginBottomPx: 6,
    itemBlockPaddingBottomPx: 3,
  },
  sale: {
    showBrandBranch: true,
    showContact: true,
    showContactRfc: true,
    showContactAddress: true,
    showContactPhone: true,
    showTicketTitle: true,
    showOrderId: true,
    showDateTime: true,
    showTableLine: true,
    showConsumoHeader: true,
    showItemQuantity: true,
    showItemExtras: true,
    showLinePrice: true,
    showItemNote: true,
    showSubtotal: true,
    showIva: true,
    showTip: true,
    showTotal: true,
    showPaymentMethod: true,
    showDeliveredStatus: true,
    showFooter: true,
    footerText: 'Restify',
    centerTotalsBlock: true,
  },
  kitchen: {
    showBrandBranch: true,
    showOrderId: true,
    showTableLine: true,
    showPedidoHeader: true,
    showItemQuantity: true,
    showItemExtras: true,
    showItemNote: true,
  },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge<T extends Record<string, unknown>>(defaults: T, partial: unknown): T {
  if (!isPlainObject(partial)) return { ...defaults };
  const out = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const dk = defaults[key as keyof T];
    const pk = partial[key];
    if (pk === undefined) continue;
    if (isPlainObject(dk) && isPlainObject(pk)) {
      (out as Record<string, unknown>)[key] = deepMerge(dk as Record<string, unknown>, pk);
    } else {
      (out as Record<string, unknown>)[key] = pk;
    }
  }
  return out as T;
}

export function mergeTicketPrintConfig(stored: unknown): ResolvedTicketPrintConfig {
  const base = structuredClone(DEFAULT_TICKET_PRINT_CONFIG) as unknown as Record<string, unknown>;
  if (!isPlainObject(stored)) {
    return structuredClone(DEFAULT_TICKET_PRINT_CONFIG);
  }
  const merged = deepMerge(base, stored) as unknown as ResolvedTicketPrintConfig;
  merged.schemaVersion = 1;
  if (typeof merged.sale.footerText !== 'string' || merged.sale.footerText.trim() === '') {
    merged.sale.footerText = DEFAULT_TICKET_PRINT_CONFIG.sale.footerText;
  }
  return merged;
}
