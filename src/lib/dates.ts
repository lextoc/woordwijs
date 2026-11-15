export function todayISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

const DAY_LABELS = ["zo", "ma", "di", "wo", "do", "vr", "za"] as const;

export function lastSevenDays(today: string): { iso: string; label: string }[] {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const iso = addDays(today, -offset);
    const [year, month, day] = iso.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    days.push({ iso, label: DAY_LABELS[date.getDay()] });
  }
  return days;
}

export function currentStreak(days: string[], today: string): number {
  const counted = new Set(days);
  let anchor = today;
  if (!counted.has(today)) {
    const yesterday = addDays(today, -1);
    if (!counted.has(yesterday)) return 0;
    anchor = yesterday;
  }
  let streak = 0;
  let cursor = anchor;
  while (counted.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(days: string[]): number {
  const unique = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let previous = "";
  for (const day of unique) {
    if (previous && day === addDays(previous, 1)) run += 1;
    else run = 1;
    previous = day;
    if (run > best) best = run;
  }
  return best;
}
