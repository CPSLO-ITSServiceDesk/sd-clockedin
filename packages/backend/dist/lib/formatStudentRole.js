"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatStudentRole = formatStudentRole;
function formatStudentRole(position) {
    if (position === 'student lead, student assistant') {
        return 'Student Assistant';
    }
    return position;
}
