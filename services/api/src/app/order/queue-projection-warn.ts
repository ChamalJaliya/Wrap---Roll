import type { Logger } from '@nestjs/common';
import type {
  CourierQueueOrder,
  KitchenQueueOrder,
  OpsQueueOrder,
  ResponsePersona,
} from '@wrap-roll/contracts';
import {
  courierQueueForbiddenKeysPresent,
  describeQueueProjectionZodIssues,
  kitchenQueueForbiddenKeysPresent,
} from '@wrap-roll/contracts';

function shouldRunQueueProjectionChecks(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.QUEUE_PROJECTION_VALIDATE === '0') return false;
  if (process.env.QUEUE_PROJECTION_VALIDATE === '1') return true;
  return process.env.NODE_ENV !== 'production';
}

/** Logs when forbidden keys leak or Zod drifts from TS projectors (non-prod by default). */
export function warnIfQueueProjectionAnomalies(
  logger: Logger,
  persona: ResponsePersona,
  row: OpsQueueOrder | KitchenQueueOrder | CourierQueueOrder,
): void {
  if (persona === 'ops' || !shouldRunQueueProjectionChecks()) return;

  if (persona === 'kitchen') {
    const leaks = kitchenQueueForbiddenKeysPresent(row as object);
    if (leaks.length > 0) {
      logger.warn(
        `Queue projection (kitchen): forbidden keys in payload: ${leaks.join(', ')}`,
      );
    }
    const zodIssues = describeQueueProjectionZodIssues('kitchen', row);
    if (zodIssues.length > 0) {
      logger.warn(`Queue projection (kitchen) Zod mismatch: ${zodIssues[0]}`);
    }
    return;
  }

  const leaks = courierQueueForbiddenKeysPresent(row as object);
  if (leaks.length > 0) {
    logger.warn(
      `Queue projection (courier): forbidden keys in payload: ${leaks.join(', ')}`,
    );
  }
  const zodIssues = describeQueueProjectionZodIssues('courier', row);
  if (zodIssues.length > 0) {
    logger.warn(`Queue projection (courier) Zod mismatch: ${zodIssues[0]}`);
  }
}
