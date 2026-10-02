import cron from 'node-cron';
import { isMicrosoftGraphEnabled } from '../lib/microsoftGraph';
import { ORG_TIMEZONE } from '../lib/orgTime';
import { teamsSyncService } from '../services/teamsSyncService';
import type { Database } from '../types/database.types';

type Term = Database['public']['Tables']['academic_term']['Row'];

export async function runTeamsSync(termId?: number): Promise<void> {
  if (termId != null) {
    await teamsSyncService.syncTerm(termId);
    return;
  }

  const result = await teamsSyncService.syncActiveTerm();
  if (!result) {
    console.log('Teams sync: no active term, skipping');
  }
}

/** Fire-and-forget after an active term is created or updated. */
export function triggerTeamsSyncForTerm(
  term: Pick<Term, 'id' | 'is_active'>,
): void {
  if (term.is_active !== true) return;

  void teamsSyncService.syncTerm(term.id).catch((err) => {
    console.error(`Teams sync after term ${term.id} save failed:`, err);
  });
}

export function scheduleTeamsSync(): void {
  if (!isMicrosoftGraphEnabled()) {
    console.log('Teams sync: disabled (Microsoft Graph not configured)');
    return;
  }

  const cronExpr = '0 * * * *';
  if (!cron.validate(cronExpr)) {
    throw new Error(`Invalid Teams sync cron expression: ${cronExpr}`);
  }

  cron.schedule(
    cronExpr,
    () => {
      runTeamsSync().catch((err) => {
        console.error('Teams sync failed:', err);
      });
    },
    { timezone: ORG_TIMEZONE },
  );

  console.log(`Teams sync scheduled hourly in ${ORG_TIMEZONE}`);
}
