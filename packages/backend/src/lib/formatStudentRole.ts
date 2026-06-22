export function formatStudentRole(position: string): string {
  if (position === 'student lead, student assistant') {
    return 'Student Assistant';
  }
  return position;
}
