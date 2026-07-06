import cron from 'node-cron';
import { config } from '../config/environment';
import { getOrgLocalCutoffInstant, ORG_TIMEZONE } from '../lib/orgTime';
import { timeEntryService } from '../services/timeEntryService';

export async function runAutoClockOut(now: Date = new Date()): Promise<void> {
  const { hour, minute } = config.autoClockOut;
  const cutoff = getOrgLocalCutoffInstant(now, hour, minute);
  const result = await timeEntryService.autoClockOutOpen(cutoff.toISOString(), now);

  const parts = [`Auto clock-out: closed ${result.closedCount} entries`];
  if (result.staleCount > 0) {
    parts.push(`${result.staleCount} stale`);
  }
  if (result.skippedCount > 0) {
    parts.push(`skipped ${result.skippedCount}`);
  }
  console.log(parts.join(', '));
}

export function scheduleAutoClockOut(): void {
  const { enabled, hour, minute } = config.autoClockOut;

  if (!enabled) {
    console.log('Auto clock-out: disabled');
    return;
  }

  const cronExpr = `${minute} ${hour} * * *`;
  if (!cron.validate(cronExpr)) {
    throw new Error(`Invalid auto clock-out cron expression: ${cronExpr}`);
  }

  cron.schedule(
    cronExpr,
    () => {
      runAutoClockOut().catch((err) => {
        console.error('Auto clock-out failed:', err);
      });
    },
    { timezone: ORG_TIMEZONE },
  );

  console.log(
    `Auto clock-out scheduled daily at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ORG_TIMEZONE}`,
  );
}
