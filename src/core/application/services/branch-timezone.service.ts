import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../domain/interfaces/branch-repository.interface';
import { getBranchId } from '../../infrastructure/tenant/tenant-context';
import { APP_TIMEZONE } from '../../../shared/constants';
import { isValidTimeZone } from '../../../shared/utils/timezone.util';

/**
 * Zona horaria de la sucursal en curso: la que define dónde empieza y termina el día
 * comercial en dashboard y reportes.
 *
 * Lee la base en cada uso a propósito. Guardar el valor en memoria obligaría a limpiarlo
 * cada vez que se edita una sucursal, y olvidarse agruparía los totales por el día
 * equivocado sin ningún error visible.
 */
@injectable()
export class BranchTimezoneService {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository
  ) {}

  /** Cae a APP_TIMEZONE si no hay sucursal en curso o si la guardada no sirve. */
  async get(): Promise<string> {
    const branchId = getBranchId();
    if (!branchId) return APP_TIMEZONE;

    const timezone = (await this.branchRepository.findById(branchId))?.timezone;
    return timezone && isValidTimeZone(timezone) ? timezone : APP_TIMEZONE;
  }
}
