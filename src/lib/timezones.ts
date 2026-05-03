// IANA timezone list for the user timezone dropdown.
// Postgres understands these natively for `AT TIME ZONE` operations.

export type TimezoneOption = {
  value: string;
  label: string;
};

export const TIMEZONES: TimezoneOption[] = [
  { value: "America/New_York",     label: "Eastern Time (ET)" },
  { value: "America/Chicago",      label: "Central Time (CT)" },
  { value: "America/Denver",       label: "Mountain Time (MT)" },
  { value: "America/Phoenix",      label: "Arizona (MST, no DST)" },
  { value: "America/Los_Angeles",  label: "Pacific Time (PT)" },
  { value: "America/Anchorage",    label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu",     label: "Hawaii Time (HT)" },
  { value: "America/Halifax",      label: "Atlantic Time (AT)" },
  { value: "America/St_Johns",     label: "Newfoundland Time (NT)" },
];

export const DEFAULT_TIMEZONE = "America/Chicago";

export function timezoneLabel(value: string | null | undefined): string {
  if (!value) return "Central Time (CT)";
  const tz = TIMEZONES.find((t) => t.value === value);
  return tz ? tz.label : value;
}
