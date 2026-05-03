// Common North American timezones for the user/team timezone dropdown.
// Using IANA names which Postgres understands natively.
export const TIMEZONES = [
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

export function timezoneLabel(value) {
  const tz = TIMEZONES.find(t => t.value === value);
  return tz ? tz.label : value;
}
