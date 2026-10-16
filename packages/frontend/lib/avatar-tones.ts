const AVATAR_TONES = [
  "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  "bg-accent/15 text-accent",
  "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
  "bg-pink-500/15 text-pink-800 dark:text-pink-200",
  "bg-muted text-muted-foreground",
]

/** Stable avatar color for a person, so they keep it across screens and refreshes. */
export function getAvatarToneClass(studentAssistantId: number): string {
  return AVATAR_TONES[studentAssistantId % AVATAR_TONES.length]
}
