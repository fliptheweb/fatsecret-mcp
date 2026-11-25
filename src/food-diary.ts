/**
 * Converts a YYYY-MM-DD date string to "days since January 1, 1970".
 */
export function dateToDays(dateStr: string): number {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / (1000 * 60 * 60 * 24));
}

/** Today's date (YYYY-MM-DD) in the server's local time zone; set TZ to change it. */
export function localDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Missing dates default to the local "today" instead of leaving it to FatSecret, whose
 * own "today" is in its time zone and puts late-evening/early-morning entries on the wrong day.
 */
export function optionalDateToDays(dateStr?: string): number {
  return dateToDays(dateStr ?? localDate());
}

export function buildGetFoodEntriesQuery({
  date,
  food_entry_id,
}: {
  date?: string;
  food_entry_id?: number;
}) {
  const query: { date?: number; food_entry_id?: number; format: 'json' } = { format: 'json' };

  // A real entry ID identifies the entry on its own; otherwise list the date (default today)
  if (food_entry_id !== undefined && food_entry_id > 0) {
    query.food_entry_id = food_entry_id;
    if (date) query.date = dateToDays(date);
  } else {
    query.date = optionalDateToDays(date);
  }

  return query;
}
