"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORG_TIMEZONE = void 0;
exports.getOrgLocalMinutes = getOrgLocalMinutes;
exports.getOrgLocalDateString = getOrgLocalDateString;
exports.getOrgDayOfWeek = getOrgDayOfWeek;
exports.getOrgLocalInstant = getOrgLocalInstant;
exports.getOrgLocalCutoffInstant = getOrgLocalCutoffInstant;
exports.isValidOrgLocalDateString = isValidOrgLocalDateString;
exports.resolveShiftsReferenceNow = resolveShiftsReferenceNow;
/** IANA timezone for campus wall-clock times (schedule blocks, shift windows). */
exports.ORG_TIMEZONE = process.env.ORG_TIMEZONE ?? 'America/Los_Angeles';
function getPart(parts, type) {
    return parts.find((part) => part.type === type)?.value ?? '';
}
/** Minutes since midnight in the organization timezone. */
function getOrgLocalMinutes(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: exports.ORG_TIMEZONE,
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(getPart(parts, 'hour'));
    const minute = Number(getPart(parts, 'minute'));
    return hour * 60 + minute;
}
/** YYYY-MM-DD calendar date in the organization timezone. */
function getOrgLocalDateString(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: exports.ORG_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    return `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}`;
}
/** JS day index (0=Sunday … 6=Saturday) in the organization timezone. */
function getOrgDayOfWeek(now = new Date()) {
    const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: exports.ORG_TIMEZONE,
        weekday: 'short',
    }).format(now);
    const map = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };
    return map[weekday] ?? 0;
}
/**
 * UTC instant for a wall-clock time on an org-local calendar day (YYYY-MM-DD).
 * Uses binary search over Intl-derived org-local date/minutes (no extra deps).
 */
function getOrgLocalInstant(dateStr, hour = 0, minute = 0) {
    const targetMinutes = hour * 60 + minute;
    const [y, m, d] = dateStr.split('-').map(Number);
    // LA is UTC-7/UTC-8, so local midnight can fall on the prior UTC calendar day.
    let low = Date.UTC(y, m - 1, d - 1, 0, 0, 0);
    let high = Date.UTC(y, m - 1, d + 1, 23, 59, 59);
    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = new Date(mid);
        const candidateDate = getOrgLocalDateString(candidate);
        const candidateMinutes = getOrgLocalMinutes(candidate);
        const isBefore = candidateDate < dateStr ||
            (candidateDate === dateStr && candidateMinutes < targetMinutes);
        if (isBefore) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    const result = new Date(low);
    if (getOrgLocalDateString(result) !== dateStr ||
        getOrgLocalMinutes(result) !== targetMinutes) {
        throw new Error(`Could not resolve cutoff instant for ${dateStr} ${hour}:${String(minute).padStart(2, '0')} in ${exports.ORG_TIMEZONE}`);
    }
    return result;
}
/**
 * UTC instant for a wall-clock time on the org-local calendar day of `now`.
 */
function getOrgLocalCutoffInstant(now = new Date(), hour = 17, minute = 0) {
    return getOrgLocalInstant(getOrgLocalDateString(now), hour, minute);
}
const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** True when value is a real calendar YYYY-MM-DD. */
function isValidOrgLocalDateString(value) {
    if (!LOCAL_DATE_RE.test(value))
        return false;
    const [year, month, day] = value.split('-').map(Number);
    const probe = new Date(Date.UTC(year, month - 1, day));
    return (probe.getUTCFullYear() === year &&
        probe.getUTCMonth() === month - 1 &&
        probe.getUTCDate() === day);
}
/**
 * Resolve the `now` instant used for shift lookups.
 * - omitted / today → live clock
 * - past date → 4 PM org-local (all daytime hours elapsed)
 * - future date → midnight org-local (no hours started)
 */
function resolveShiftsReferenceNow(dateParam, now = new Date()) {
    if (!dateParam)
        return now;
    const today = getOrgLocalDateString(now);
    if (dateParam === today)
        return now;
    if (dateParam < today)
        return getOrgLocalInstant(dateParam, 16, 0);
    return getOrgLocalInstant(dateParam, 0, 0);
}
