export function formatStudentRole(position: string): string {
  if (position === 'student_lead') {
    return 'Student Lead';
  }
  if (position === 'student_assistant' || position === 'student lead, student assistant') {
    return 'Student Assistant';
  }
  return position;
}
