"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMPORT_GROUP = exports.REQUIRED_HEADERS = void 0;
exports.parseScheduleSpreadsheet = parseScheduleSpreadsheet;
const XLSX = __importStar(require("xlsx"));
exports.REQUIRED_HEADERS = [
    'Member',
    'Work Email',
    'Group',
    'Start Date',
    'Start Time',
    'End Date',
    'End Time',
];
exports.IMPORT_GROUP = 'Service Desk';
const PREFERRED_SHEET_NAMES = ['Shifts', 'Schedule', 'Schedules'];
function normalizeHeader(value) {
    return String(value ?? '').trim();
}
function headerRowHasRequiredColumns(headerRow) {
    const headerSet = new Set(headerRow.map(normalizeHeader).filter(Boolean));
    return exports.REQUIRED_HEADERS.every((header) => headerSet.has(header));
}
function cellValue(row, index) {
    const value = row[index];
    if (value == null)
        return '';
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    return String(value).trim();
}
function sheetToRows(sheet) {
    return XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
    });
}
function findWorksheetRows(workbook) {
    for (const preferredName of PREFERRED_SHEET_NAMES) {
        const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() === preferredName.toLowerCase());
        if (!sheetName)
            continue;
        const rows = sheetToRows(workbook.Sheets[sheetName]);
        if (rows.length > 0 && headerRowHasRequiredColumns(rows[0].map(normalizeHeader))) {
            return rows;
        }
    }
    for (const sheetName of workbook.SheetNames) {
        const rows = sheetToRows(workbook.Sheets[sheetName]);
        if (rows.length > 0 && headerRowHasRequiredColumns(rows[0].map(normalizeHeader))) {
            return rows;
        }
    }
    throw new Error('No worksheet found with schedule headers on row 1. Expected columns like Member, Work Email, Group, Start Date, and Start Time (When I Work exports usually include a Shifts sheet).');
}
function parseWorksheetRows(rows) {
    if (rows.length === 0) {
        throw new Error('Spreadsheet is empty');
    }
    const headerRow = rows[0].map(normalizeHeader);
    if (!headerRowHasRequiredColumns(headerRow)) {
        const missing = exports.REQUIRED_HEADERS.filter((header) => !headerRow.includes(header));
        throw new Error(`Row 1 must contain the header columns. Missing: ${missing.join(', ')}`);
    }
    const headerIndex = new Map(headerRow.map((header, index) => [header, index]));
    const memberIdx = headerIndex.get('Member');
    const emailIdx = headerIndex.get('Work Email');
    const groupIdx = headerIndex.get('Group');
    const startDateIdx = headerIndex.get('Start Date');
    const startTimeIdx = headerIndex.get('Start Time');
    const endDateIdx = headerIndex.get('End Date');
    const endTimeIdx = headerIndex.get('End Time');
    const parsed = [];
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        if (!Array.isArray(row))
            continue;
        const member = cellValue(row, memberIdx);
        const workEmail = cellValue(row, emailIdx).toLowerCase();
        const group = cellValue(row, groupIdx);
        const startDate = cellValue(row, startDateIdx);
        const startTime = cellValue(row, startTimeIdx);
        const endDate = cellValue(row, endDateIdx);
        const endTime = cellValue(row, endTimeIdx);
        if (!member && !workEmail && !startDate && !startTime) {
            continue;
        }
        if (group.toLowerCase() !== exports.IMPORT_GROUP.toLowerCase()) {
            continue;
        }
        parsed.push({
            member,
            workEmail,
            startDate,
            startTime,
            endDate,
            endTime,
            rowNumber: rowIndex + 1,
        });
    }
    if (parsed.length === 0) {
        throw new Error(`No ${exports.IMPORT_GROUP} schedule rows found in spreadsheet`);
    }
    return parsed;
}
function parseCsvRows(buffer) {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
        throw new Error('Spreadsheet is empty');
    }
    return lines.map((line) => line.split(',').map((cell) => cell.trim()));
}
function parseScheduleSpreadsheet(buffer, filename) {
    const lowerName = filename.toLowerCase();
    if (lowerName.endsWith('.csv')) {
        return parseWorksheetRows(parseCsvRows(buffer));
    }
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
        throw new Error('File must be .xlsx, .xls, or .csv');
    }
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (workbook.SheetNames.length === 0) {
        throw new Error('Spreadsheet has no worksheets');
    }
    const rows = findWorksheetRows(workbook);
    return parseWorksheetRows(rows);
}
