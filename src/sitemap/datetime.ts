/**
 * Validation of `lastmod` values.
 *
 * The sitemap protocol uses the W3C Datetime format. This module accepts
 * a calendar date (`YYYY-MM-DD`) or a date and time with a mandatory
 * time zone (`YYYY-MM-DDThh:mm[:ss[.s]]` followed by `Z` or `±hh:mm`),
 * which is the subset shared by the protocol and its XML schema. Fields
 * are range-checked here rather than left to the host's `Date` parser so
 * that behaviour is identical on every runtime.
 *
 * @module
 */

/** Matches the accepted W3C Datetime forms and captures every field. */
const W3C_DATETIME_RX =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})(?:T(?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2})(?<fraction>\.\d+)?)?(?<zone>Z|[+-]\d{2}:\d{2}))?$/u;

/** Matches a `±hh:mm` time zone offset. */
const ZONE_OFFSET_RX = /^(?<sign>[+-])(?<hours>\d{2}):(?<minutes>\d{2})$/u;

/** Web pages did not exist before 1900; earlier years are almost certainly parsing accidents. */
const MIN_YEAR = 1900;

const MAX_HOUR = 23;
const MAX_MINUTE = 59;
const MAX_SECOND = 59;
/** XML Schema allows `24:00:00` as the end of a day. */
const END_OF_DAY_HOUR = 24;
/** Time zone offsets range from -14:00 to +14:00. */
const MAX_OFFSET_HOURS = 14;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/**
 * A date-only `lastmod` has no time zone, so any calendar date that is
 * "today" somewhere on Earth (local time runs up to UTC+14) is accepted.
 */
const MAX_TIMEZONE_AHEAD_MS = MAX_OFFSET_HOURS * MS_PER_HOUR;

/** Tolerance for clock skew between the machine that wrote `lastmod` and this one. */
const CLOCK_SKEW_MS = 5 * MS_PER_MINUTE;

/** Parses a `±hh:mm` offset into milliseconds, or `undefined` if out of range. */
function parseZoneOffset(zone: string): number | undefined {
  if (zone === "Z") return 0;
  const groups = ZONE_OFFSET_RX.exec(zone)?.groups;
  if (!groups) return undefined;

  const hours = Number(groups.hours);
  const minutes = Number(groups.minutes);
  const inRange =
    (hours < MAX_OFFSET_HOURS && minutes <= MAX_MINUTE) ||
    (hours === MAX_OFFSET_HOURS && minutes === 0);
  if (!inRange) return undefined;

  const offset = hours * MS_PER_HOUR + minutes * MS_PER_MINUTE;
  return groups.sign === "-" ? -offset : offset;
}

/** Checks that year, month and day form a real calendar date (in UTC, independent of the host time zone). */
function isCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates a `lastmod` value.
 *
 * Accepts `YYYY-MM-DD`, or `YYYY-MM-DDThh:mm[:ss[.s]]` followed by `Z` or
 * `±hh:mm`. Checks calendar correctness and field ranges, rejects years
 * before 1900, and rejects values in the future (allowing for time zones
 * on date-only values and for a few minutes of clock skew on datetimes).
 *
 * @param value - The `lastmod` string to validate.
 * @param now - The current time to compare against.
 * @returns `true` if the value is an acceptable `lastmod`.
 */
export function isValidLastmod(value: string, now: Date): boolean {
  const groups = W3C_DATETIME_RX.exec(value)?.groups;
  if (!groups) return false;

  const year = Number(groups.year);
  const month = Number(groups.month);
  const day = Number(groups.day);
  if (year < MIN_YEAR || !isCalendarDate(year, month, day)) return false;

  const dateUtc = Date.UTC(year, month - 1, day);

  if (groups.hour === undefined) {
    const latestToday = new Date(now.getTime() + MAX_TIMEZONE_AHEAD_MS);
    const latestTodayUtc = Date.UTC(
      latestToday.getUTCFullYear(),
      latestToday.getUTCMonth(),
      latestToday.getUTCDate()
    );
    return dateUtc <= latestTodayUtc;
  }

  const hour = Number(groups.hour);
  const minute = Number(groups.minute);
  const second = groups.second === undefined ? 0 : Number(groups.second);
  const millisecond =
    groups.fraction === undefined
      ? 0
      : Math.round(Number(groups.fraction) * MS_PER_SECOND);

  const isEndOfDay =
    hour === END_OF_DAY_HOUR &&
    minute === 0 &&
    second === 0 &&
    millisecond === 0;
  const isTimeInRange =
    hour <= MAX_HOUR && minute <= MAX_MINUTE && second <= MAX_SECOND;
  if (!(isTimeInRange || isEndOfDay)) return false;

  const offset = parseZoneOffset(groups.zone ?? "");
  if (offset === undefined) return false;

  const timeOfDay =
    hour * MS_PER_HOUR +
    minute * MS_PER_MINUTE +
    second * MS_PER_SECOND +
    millisecond;
  const instant = dateUtc + timeOfDay - offset;
  return instant <= now.getTime() + CLOCK_SKEW_MS;
}
