"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatStudentRole = formatStudentRole;
function formatStudentRole(position) {
    if (position === 'student_lead') {
        return 'Student Lead';
    }
    if (position === 'student_assistant' || position === 'student lead, student assistant') {
        return 'Student Assistant';
    }
    return position;
}
