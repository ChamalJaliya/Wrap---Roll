/** Format minutes-from-midnight (e.g. API opening hours) as 12h time. */
export function formatMinutesTo12h(m: number): string {
  const total = Math.max(0, Math.round(m));
  const h24 = Math.floor(total / 60);
  const min = total % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${min.toString().padStart(2, '0')} ${period}`;
}

/** e.g. "Mon–Sun: 10:00 AM – 11:00 PM" */
export function formatBusinessHoursLine(
  openMinutes: number,
  closeMinutes: number,
  weekdaysLabel = 'Mon–Sun',
): string {
  return `${weekdaysLabel}: ${formatMinutesTo12h(openMinutes)} – ${formatMinutesTo12h(closeMinutes)}`;
}
