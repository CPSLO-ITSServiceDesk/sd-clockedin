import 'dotenv/config';

export const DEFAULT_TEAMS_SCHEDULING_GROUP = 'Service Desk';

export const MICROSOFT_GRAPH_REQUIRED_VARS = [
  'MICROSOFT_TENANT_ID',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'TEAMS_TEAM_ID',
] as const;

export interface MicrosoftGraphConfig {
  enabled: boolean;
  tenantId: string | undefined;
  clientId: string | undefined;
  clientSecret: string | undefined;
  teamId: string | undefined;
  schedulingGroup: string;
  missingVars: string[];
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Graph is optional: enabled only when tenant, client, secret, and team id are all set. */
export function resolveMicrosoftGraphConfig(
  env: NodeJS.Dict<string | undefined> = process.env,
): MicrosoftGraphConfig {
  const tenantId = emptyToUndefined(env.MICROSOFT_TENANT_ID);
  const clientId = emptyToUndefined(env.MICROSOFT_CLIENT_ID);
  const clientSecret = emptyToUndefined(env.MICROSOFT_CLIENT_SECRET);
  const teamId = emptyToUndefined(env.TEAMS_TEAM_ID);
  const schedulingGroup =
    emptyToUndefined(env.TEAMS_SCHEDULING_GROUP) ?? DEFAULT_TEAMS_SCHEDULING_GROUP;

  const values: Record<(typeof MICROSOFT_GRAPH_REQUIRED_VARS)[number], string | undefined> = {
    MICROSOFT_TENANT_ID: tenantId,
    MICROSOFT_CLIENT_ID: clientId,
    MICROSOFT_CLIENT_SECRET: clientSecret,
    TEAMS_TEAM_ID: teamId,
  };

  const missingVars = MICROSOFT_GRAPH_REQUIRED_VARS.filter((name) => !values[name]);

  return {
    enabled: missingVars.length === 0,
    tenantId,
    clientId,
    clientSecret,
    teamId,
    schedulingGroup,
    missingVars: [...missingVars],
  };
}

/**
 * Validates that all required environment variables are present.
 * Call this once at startup, before the server begins listening.
 */
export function loadEnvironment(): void {
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

  const missing = requiredVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  const graph = config.microsoftGraph;
  if (!graph.enabled && graph.missingVars.length < MICROSOFT_GRAPH_REQUIRED_VARS.length) {
    console.warn(
      `Microsoft Graph partially configured (missing ${graph.missingVars.join(', ')}) — Teams sync disabled.`,
    );
  }
}

function parseAllowedOrigins(): string[] {
  const raw = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseAutoClockOutTime(): { hour: number; minute: number } {
  const raw = process.env.AUTO_CLOCK_OUT_TIME ?? '17:00';
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) {
    throw new Error(`Invalid AUTO_CLOCK_OUT_TIME: ${raw} (expected HH:mm)`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`Invalid AUTO_CLOCK_OUT_TIME: ${raw}`);
  }

  return { hour, minute };
}

function parseAutoClockOutEnabled(): boolean {
  const raw = process.env.AUTO_CLOCK_OUT_ENABLED;
  if (raw === undefined) return true;
  return raw !== 'false' && raw !== '0';
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  allowedOrigins: parseAllowedOrigins(),
  nodeEnv: process.env.NODE_ENV || 'development',
  autoClockOut: {
    enabled: parseAutoClockOutEnabled(),
    ...parseAutoClockOutTime(),
  },
  microsoftGraph: resolveMicrosoftGraphConfig(),
};
