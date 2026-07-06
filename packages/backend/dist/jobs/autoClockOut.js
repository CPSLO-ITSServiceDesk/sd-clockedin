"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAutoClockOut = runAutoClockOut;
exports.scheduleAutoClockOut = scheduleAutoClockOut;
const node_cron_1 = __importDefault(require("node-cron"));
const environment_1 = require("../config/environment");
const orgTime_1 = require("../lib/orgTime");
const timeEntryService_1 = require("../services/timeEntryService");
async function runAutoClockOut(now = new Date()) {
    const { hour, minute } = environment_1.config.autoClockOut;
    const cutoff = (0, orgTime_1.getOrgLocalCutoffInstant)(now, hour, minute);
    const result = await timeEntryService_1.timeEntryService.autoClockOutOpen(cutoff.toISOString(), now);
    const parts = [`Auto clock-out: closed ${result.closedCount} entries`];
    if (result.staleCount > 0) {
        parts.push(`${result.staleCount} stale`);
    }
    if (result.skippedCount > 0) {
        parts.push(`skipped ${result.skippedCount}`);
    }
    console.log(parts.join(', '));
}
function scheduleAutoClockOut() {
    const { enabled, hour, minute } = environment_1.config.autoClockOut;
    if (!enabled) {
        console.log('Auto clock-out: disabled');
        return;
    }
    const cronExpr = `${minute} ${hour} * * *`;
    if (!node_cron_1.default.validate(cronExpr)) {
        throw new Error(`Invalid auto clock-out cron expression: ${cronExpr}`);
    }
    node_cron_1.default.schedule(cronExpr, () => {
        runAutoClockOut().catch((err) => {
            console.error('Auto clock-out failed:', err);
        });
    }, { timezone: orgTime_1.ORG_TIMEZONE });
    console.log(`Auto clock-out scheduled daily at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${orgTime_1.ORG_TIMEZONE}`);
}
