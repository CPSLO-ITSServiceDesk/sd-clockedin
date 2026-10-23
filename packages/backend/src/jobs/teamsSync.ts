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

/**
 * Once at the start of each hour the desk is open: weekdays 8:00–16:00.
 * The grid closes at 17:00, so the 4:00 run is the last one of the day.
 */
export const TEAMS_SYNC_CRON = '0 8-16 * * 1-5';

export function scheduleTeamsSync(): void {
  if (!isMicrosoftGraphEnabled()) {
    console.log('Teams sync: disabled (Microsoft Graph not configured)');
    return;
  }

  if (!cron.validate(TEAMS_SYNC_CRON)) {
    throw new Error(`Invalid Teams sync cron expression: ${TEAMS_SYNC_CRON}`);
  }

  cron.schedule(
    TEAMS_SYNC_CRON,
    () => {
      runTeamsSync().catch((err) => {
        console.error('Teams sync failed:', err);
      });
    },
    { timezone: ORG_TIMEZONE },
  );

  console.log(
    `Teams sync scheduled weekdays 8:00–16:00 on the hour in ${ORG_TIMEZONE}`,
  );
}
