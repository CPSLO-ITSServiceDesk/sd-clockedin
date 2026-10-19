import { config } from '../config/environment';
import { diffScheduleBlocks } from '../lib/diffScheduleBlocks';
import { supabase } from '../lib/supabase';
import {
  parseAvailabilityWorkbook,
  type ColumnMapping,
} from '../lib/scheduleBuilder/availabilityImport';
import { assignmentsToRuns, generateDraft } from '../lib/scheduleBuilder/generateDraft';
import {
  DEFAULT_RULES,
  normalizeRules,
  slotToTime,
  type ChangeLogEntry,
  type DraftPerson,
  type DraftRules,
  type UnmatchedResponse,
} from '../lib/scheduleBuilder/model';
import { applyImport, withRoster } from '../lib/scheduleBuilder/roster';
import type { DraftScheduleBlock } from '../lib/scheduleImportTransform';
import { HttpError } from '../middleware/errorHandler';
import type { Database, Json } from '../types/database.types';
import { scheduleBlocksService } from './scheduleBlocksService';
import { replaceScheduleBlocks } from './scheduleImportService';
import { schedulesService } from './schedulesService';
import { studentAssistantService } from './studentAssistantService';
import { termService } from './termService';

type ScheduleDraftRow = Database['public']['Tables']['schedule_draft']['Row'];

/** PostgREST/Postgres codes for a table that hasn't been created yet. */
const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01']);
const NO_ROWS = 'PGRST116';
const MISSING_TABLE_MESSAGE =
  'The schedule builder is not set up yet. Apply the schedule_draft migration (20261019100000).';

/** Keep the change log readable and the row small. */
const CHANGE_LOG_LIMIT = 200;

export interface ScheduleDraft {
  id: number;
  academic_term_id: number;
  status: 'draft' | 'published';
  step: number;
  source_filename: string | null;
  rules: DraftRules;
  people: DraftPerson[];
  unmatched: UnmatchedResponse[];
  change_log: ChangeLogEntry[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface ScheduleDraftPatch {
  step?: number;
  rules?: DraftRules;
  people?: DraftPerson[];
  unmatched?: UnmatchedResponse[];
  change_log?: ChangeLogEntry[];
}

export interface AvailabilityImportSummary {
  draft: ScheduleDraft;
  columns: ColumnMapping[];
  responses: number;
  matched: number;
  unmatched: number;
}

export interface PublishPreview {
  term: {
    id: number;
    name: string | null;
    start_date: string | null;
    end_date: string | null;
    skips: { date: string; label?: string }[];
  };
  total_shifts: number;
  new_shifts: number;
  removed_shifts: number;
  unchanged_shifts: number;
  students_affected: number;
  teams_sync_enabled: boolean;
}

function asArray<T>(value: Json): T[] {
  return Array.isArray(value) ? (value as unknown as T[]) : [];
}

function toDraft(row: ScheduleDraftRow): ScheduleDraft {
  return {
    id: row.id,
    academic_term_id: row.academic_term_id,
    status: row.status === 'published' ? 'published' : 'draft',
    step: row.step,
    source_filename: row.source_filename,
    rules: normalizeRules(row.rules),
    people: asArray<DraftPerson>(row.people),
    unmatched: asArray<UnmatchedResponse>(row.unmatched),
    change_log: asArray<ChangeLogEntry>(row.change_log),
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
  };
}

function throwDbError(error: { code?: string; message: string }): never {
  if (error.code && MISSING_TABLE_CODES.has(error.code)) throw new HttpError(503, MISSING_TABLE_MESSAGE);
  throw new HttpError(500, error.message);
}

function logEntry(by: ChangeLogEntry['by'], text: string): ChangeLogEntry {
  return { at: new Date().toISOString(), by, text };
}

function appendLog(log: ChangeLogEntry[], entry: ChangeLogEntry): ChangeLogEntry[] {
  return [...log, entry].slice(-CHANGE_LOG_LIMIT);
}

function toBlocks(person: DraftPerson): DraftScheduleBlock[] {
  return assignmentsToRuns(person.assignments).map(({ day, start, end }) => ({
    day,
    start_time: slotToTime(start),
    end_time: slotToTime(end),
    is_remote: false,
  }));
}

async function getRow(id: number): Promise<ScheduleDraftRow> {
  const { data, error } = await supabase.from('schedule_draft').select('*').eq('id', id).single();
  if (error) {
    if (error.code === NO_ROWS) throw new HttpError(404, 'Schedule draft not found');
    throwDbError(error);
  }
  return data;
}

async function save(id: number, patch: Database['public']['Tables']['schedule_draft']['Update']) {
  const { data, error } = await supabase
    .from('schedule_draft')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if (error.code === NO_ROWS) throw new HttpError(404, 'Schedule draft not found');
    throwDbError(error);
  }
  return toDraft(data);
}

/** Draft with any newly active students merged in, so the roster is always current. */
async function withCurrentRoster(draft: ScheduleDraft): Promise<ScheduleDraft> {
  const students = await studentAssistantService.getAll();
  return { ...draft, people: withRoster(draft.people, students) };
}

export const scheduleDraftService = {
  async getLatestForTerm(termId: number): Promise<ScheduleDraft | null> {
    const { data, error } = await supabase
      .from('schedule_draft')
      .select('*')
      .eq('academic_term_id', termId)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) throwDbError(error);
    const row = data?.[0];
    return row ? withCurrentRoster(toDraft(row)) : null;
  },

  async getById(id: number): Promise<ScheduleDraft> {
    return withCurrentRoster(toDraft(await getRow(id)));
  },

  async create(termId: number): Promise<ScheduleDraft> {
    const term = await termService.getById(termId);
    if (!term) throw new HttpError(404, 'Academic term not found');

    const students = await studentAssistantService.getAll();
    const { data, error } = await supabase
      .from('schedule_draft')
      .insert({
        academic_term_id: termId,
        rules: DEFAULT_RULES as unknown as Json,
        people: withRoster([], students) as unknown as Json,
        change_log: [logEntry('builder', `Started ${term.name ?? 'term'} schedule`)] as unknown as Json,
      })
      .select()
      .single();
    if (error) throwDbError(error);
    return toDraft(data);
  },

  async update(id: number, patch: ScheduleDraftPatch): Promise<ScheduleDraft> {
    const update: Database['public']['Tables']['schedule_draft']['Update'] = {};
    if (patch.step != null) update.step = patch.step;
    if (patch.rules) update.rules = normalizeRules(patch.rules) as unknown as Json;
    if (patch.people) update.people = patch.people as unknown as Json;
    if (patch.unmatched) update.unmatched = patch.unmatched as unknown as Json;
    if (patch.change_log) update.change_log = patch.change_log.slice(-CHANGE_LOG_LIMIT) as unknown as Json;
    return save(id, update);
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase.from('schedule_draft').delete().eq('id', id);
    if (error) throwDbError(error);
  },

  async importAvailability(id: number, buffer: Buffer, filename: string): Promise<AvailabilityImportSummary> {
    let parsed;
    try {
      parsed = parseAvailabilityWorkbook(buffer, filename);
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Could not read the file');
    }

    const draft = await this.getById(id);
    const students = await studentAssistantService.getAll();
    const { people, unmatched, matched } = applyImport(draft.people, parsed.responses, students);

    const saved = await save(id, {
      source_filename: filename,
      people: people as unknown as Json,
      unmatched: unmatched as unknown as Json,
      change_log: appendLog(
        draft.change_log,
        logEntry('import', `Imported ${parsed.responses.length} responses from ${filename}`),
      ) as unknown as Json,
    });

    return {
      draft: saved,
      columns: parsed.columns,
      responses: parsed.responses.length,
      matched,
      unmatched: unmatched.length,
    };
  },

  async generate(id: number): Promise<ScheduleDraft> {
    const draft = await this.getById(id);
    const people = generateDraft(draft.people, draft.rules);
    const shifts = people.reduce((sum, person) => sum + assignmentsToRuns(person.assignments).length, 0);
    return save(id, {
      people: people as unknown as Json,
      step: Math.max(draft.step, 3),
      change_log: appendLog(draft.change_log, logEntry('builder', `Generated a draft with ${shifts} shifts`)) as unknown as Json,
    });
  },

  async publishPreview(id: number): Promise<PublishPreview> {
    const draft = await this.getById(id);
    const term = await termService.getById(draft.academic_term_id);
    if (!term) throw new HttpError(404, 'Academic term not found');

    const [schedules, blocks] = await Promise.all([
      schedulesService.getAll(),
      scheduleBlocksService.getAll(),
    ]);

    let total = 0;
    let added = 0;
    let removed = 0;
    let unchanged = 0;
    let affected = 0;
    for (const person of draft.people) {
      const next = toBlocks(person);
      const schedule = schedules.find(
        (entry) =>
          entry.student_assistant_id === person.student_assistant_id &&
          entry.academic_term_id === term.id,
      );
      const existing = schedule ? blocks.filter((block) => block.schedule_id === schedule.id) : [];
      const diff = diffScheduleBlocks(existing, next);
      total += next.length;
      added += diff.creates.length;
      removed += diff.removeIds.length;
      unchanged += diff.keepIds.length + diff.updates.length;
      if (diff.creates.length + diff.removeIds.length + diff.updates.length > 0) affected += 1;
    }

    const offDays = (term.off_days ?? {}) as { vacations?: { date: string; label?: string }[] };
    return {
      term: {
        id: term.id,
        name: term.name,
        start_date: term.start_date,
        end_date: term.end_date,
        skips: Array.isArray(offDays.vacations) ? offDays.vacations : [],
      },
      total_shifts: total,
      new_shifts: added,
      removed_shifts: removed,
      unchanged_shifts: unchanged,
      students_affected: affected,
      teams_sync_enabled: config.microsoftGraph.enabled,
    };
  },

  async publish(id: number): Promise<ScheduleDraft> {
    const draft = await this.getById(id);
    for (const person of draft.people) {
      const blocks = toBlocks(person);
      // Don't create empty schedules for people who were never scheduled this term.
      if (
        blocks.length === 0 &&
        !(await schedulesService.getByStudentAndTerm(person.student_assistant_id, draft.academic_term_id))
      ) {
        continue;
      }
      await replaceScheduleBlocks(person.student_assistant_id, draft.academic_term_id, blocks, false);
    }
    const shifts = draft.people.reduce((sum, person) => sum + toBlocks(person).length, 0);
    return save(id, {
      status: 'published',
      step: 4,
      published_at: new Date().toISOString(),
      change_log: appendLog(draft.change_log, logEntry('you', `Published ${shifts} shifts to Schedules`)) as unknown as Json,
    });
  },
};
