export function calculateNights(arrivalDate: string, departureDate: string): number {
  if (!arrivalDate || !departureDate) return 0;
  const arrival = new Date(`${arrivalDate}T12:00:00`);
  const departure = new Date(`${departureDate}T12:00:00`);
  const difference = departure.getTime() - arrival.getTime();
  return Math.max(0, Math.round(difference / 86_400_000));
}

export function formatDateRange(arrivalDate: string, departureDate: string): string {
  const arrival = new Date(`${arrivalDate}T12:00:00`);
  const departure = new Date(`${departureDate}T12:00:00`);
  if (Number.isNaN(arrival.getTime()) || Number.isNaN(departure.getTime())) return 'Dates not set';

  const sameYear = arrival.getFullYear() === departure.getFullYear();
  const sameMonth = sameYear && arrival.getMonth() === departure.getMonth();
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' });

  if (sameMonth) {
    return `${month.format(arrival)} ${arrival.getDate()}–${departure.getDate()}, ${departure.getFullYear()}`;
  }

  const left = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  }).format(arrival);
  const right = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(departure);
  return `${left} – ${right}`;
}
