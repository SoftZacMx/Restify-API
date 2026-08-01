import { fromZonedTime } from 'date-fns-tz';
import { GetReportsSummaryUseCase } from '../../../../src/core/application/use-cases/reports/get-reports-summary.use-case';
import { IReportsSummaryRepository } from '../../../../src/core/domain/interfaces/reports-summary-repository.interface';
import { BranchTimezoneService } from '../../../../src/core/application/services/branch-timezone.service';
import { ReportsSummaryResponse } from '../../../../src/core/application/dto/reports-summary.dto';
import { startOfDayInZone, endOfDayInZone } from '../../../../src/shared/utils/date-range.util';

const TIMEZONE = 'America/Mexico_City';
const DAY_MS = 24 * 60 * 60 * 1000;

describe('GetReportsSummaryUseCase', () => {
  let useCase: GetReportsSummaryUseCase;
  let reportsSummaryRepository: jest.Mocked<IReportsSummaryRepository>;
  let branchTimezoneService: jest.Mocked<BranchTimezoneService>;

  beforeEach(() => {
    reportsSummaryRepository = {
      getSummary: jest.fn(),
    } as unknown as jest.Mocked<IReportsSummaryRepository>;
    branchTimezoneService = {
      get: jest.fn().mockResolvedValue(TIMEZONE),
    } as unknown as jest.Mocked<BranchTimezoneService>;
    reportsSummaryRepository.getSummary.mockResolvedValue({} as ReportsSummaryResponse);

    useCase = new GetReportsSummaryUseCase(reportsSummaryRepository, branchTimezoneService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('pasa el rango al repositorio con los límites del día en la zona horaria', async () => {
    await useCase.execute({ dateFrom: '2026-07-01', dateTo: '2026-07-31' });

    expect(reportsSummaryRepository.getSummary).toHaveBeenCalledTimes(1);
    const [dateFrom, dateTo, timezone] = reportsSummaryRepository.getSummary.mock.calls[0];
    expect(timezone).toBe(TIMEZONE);
    expect(dateFrom).toEqual(startOfDayInZone('2026-07-01', TIMEZONE));
    expect(dateTo).toEqual(endOfDayInZone('2026-07-31', TIMEZONE));
    expect(fromZonedTime('2026-07-01 00:00:00.000', TIMEZONE).getTime()).toBe(dateFrom.getTime());
  });

  it('lanza error cuando dateFrom es posterior a dateTo', async () => {
    await expect(
      useCase.execute({ dateFrom: '2026-08-01', dateTo: '2026-07-01' })
    ).rejects.toThrow('dateFrom must be before or equal to dateTo');
    expect(reportsSummaryRepository.getSummary).not.toHaveBeenCalled();
  });

  it('sin query usa 30 días hasta ahora', async () => {
    const before = Date.now();
    await useCase.execute();
    const after = Date.now();

    const [dateFrom, dateTo, timezone] = reportsSummaryRepository.getSummary.mock.calls[0];
    expect(timezone).toBe(TIMEZONE);
    expect(dateTo.getTime()).toBeGreaterThanOrEqual(before);
    expect(dateTo.getTime()).toBeLessThanOrEqual(after);
    expect(dateFrom.getTime()).toBe(dateTo.getTime() - 29 * DAY_MS);
  });

  it('deriva dateFrom desde dateTo cuando falta dateFrom', async () => {
    await useCase.execute({ dateTo: '2026-07-31' });

    const [dateFrom, dateTo] = reportsSummaryRepository.getSummary.mock.calls[0];
    expect(dateTo).toEqual(endOfDayInZone('2026-07-31', TIMEZONE));
    expect(dateFrom.getTime()).toBe(dateTo.getTime() - 29 * DAY_MS);
  });

  it('usa ahora como dateTo cuando falta dateTo', async () => {
    const before = Date.now();
    await useCase.execute({ dateFrom: '2026-07-01' });
    const after = Date.now();

    const [dateFrom, dateTo] = reportsSummaryRepository.getSummary.mock.calls[0];
    expect(dateFrom).toEqual(startOfDayInZone('2026-07-01', TIMEZONE));
    expect(dateTo.getTime()).toBeGreaterThanOrEqual(before);
    expect(dateTo.getTime()).toBeLessThanOrEqual(after);
  });
});
