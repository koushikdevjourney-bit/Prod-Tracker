const MINUTES_PER_DAY = 24 * 60;

function parseTimeToMinutes(time) {
  const [h, m] = String(time || '')
    .split(':')
    .map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function daysBetween(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86400000);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function calculateDuration(startTime, endTime, startDate, endDate) {
  const start = parseTimeToMinutes(startTime);
  let end = parseTimeToMinutes(endTime);

  if (startDate && endDate && endDate !== startDate) {
    end += daysBetween(startDate, endDate) * MINUTES_PER_DAY;
  } else if (end <= start) {
    end += MINUTES_PER_DAY;
  }

  return Math.max(0, end - start);
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTimeKey(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

module.exports = {
  addDays,
  calculateDuration,
  isDateKey,
  isTimeKey,
  parseTimeToMinutes,
};
