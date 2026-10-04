const TIME_ZONE = "America/Mexico_City";

const DAYS_FROM_MONDAY: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function calendarInMexico(date: Date) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: string) =>
    formatted.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: value("weekday"),
  };
}

function shiftCalendar(year: number, month: number, day: number, days: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function mexicoMidnight(year: number, month: number, day: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const probe = new Date(Date.UTC(year, month - 1, day, 18, 0, 0));
  const zoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(probe)
    .find((part) => part.type === "timeZoneName")?.value;
  const offset = zoneName?.match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? "-06:00";
  return new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00${offset}`);
}

export function mexicoDateString(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentWeekInMexico(now = new Date()) {
  const today = calendarInMexico(now);
  const monday = shiftCalendar(
    today.year,
    today.month,
    today.day,
    -DAYS_FROM_MONDAY[today.weekday],
  );
  const nextMonday = shiftCalendar(monday.year, monday.month, monday.day, 7);

  return {
    start: mexicoMidnight(monday.year, monday.month, monday.day),
    end: mexicoMidnight(nextMonday.year, nextMonday.month, nextMonday.day),
  };
}

export function formatWeekRange(start: Date, end: Date) {
  const sunday = new Date(end.getTime() - 1);
  const dayMonth = new Intl.DateTimeFormat("es-MX", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
  });
  const year = new Intl.DateTimeFormat("es-MX", {
    timeZone: TIME_ZONE,
    year: "numeric",
  }).format(sunday);

  return `${dayMonth.format(start)} – ${dayMonth.format(sunday)} ${year}`;
}
