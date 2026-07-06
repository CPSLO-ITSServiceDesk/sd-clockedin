"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTimeKey = normalizeTimeKey;
exports.timeToMinutes = timeToMinutes;
const orgTime_1 = require("./orgTime");
function parseTimeValue(value) {
    if (value.includes('T')) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const timePattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/;
    const match = timePattern.exec(value.trim());
    if (!match) {
        return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
        return null;
    }
    return new Date(2000, 0, 1, hours, minutes);
}
function isoToOrgMinutes(value) {
    if (!value.includes('T'))
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    return (0, orgTime_1.getOrgLocalMinutes)(date);
}
/** Normalize time strings to HH:mm for sorting and comparison. */
function normalizeTimeKey(value) {
    const orgMinutes = isoToOrgMinutes(value);
    if (orgMinutes !== null) {
        const hours = Math.floor(orgMinutes / 60).toString().padStart(2, '0');
        const minutes = (orgMinutes % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    const date = parseTimeValue(value);
    if (!date) {
        return value;
    }
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}
/** Convert a time-of-day or ISO timestamp to minutes since midnight (org local). */
function timeToMinutes(value) {
    const orgMinutes = isoToOrgMinutes(value);
    if (orgMinutes !== null) {
        return orgMinutes;
    }
    const normalized = normalizeTimeKey(value);
    const [hours, minutes] = normalized.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return Number.NaN;
    }
    return hours * 60 + minutes;
}
