const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const Habit = require('../models/Habit');
const UserSettings = require('../models/UserSettings');
const UserGrit = require('../models/UserGrit');
const UserAcademics = require('../models/UserAcademics');
const UserProgress = require('../models/UserProgress');
const { ACTIVITY_TYPES } = require('../models/Activity');
const { GOAL_PERIODS } = require('../models/Goal');
const { THEMES } = require('../models/UserSettings');
const { GRIT_RESULTS, GRIT_TARGETS } = require('../models/UserGrit');
const { addDays, calculateDuration, isDateKey, isTimeKey } = require('../utils/time');
const { toClient, toClientList } = require('../utils/serialize');

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function optionalId(body) {
  if (typeof body?._id === 'string' && /^[a-fA-F0-9]{24}$/.test(body._id)) return body._id;
  return undefined;
}

function withOptionalId(fields, body) {
  const _id = optionalId(body);
  return _id ? { ...fields, _id } : fields;
}

function requireOwned(doc, message = 'Not found') {
  if (!doc) throw httpError(message, 404);
  return doc;
}

function buildActivityFields(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const date = body.date;
  const startTime = body.startTime;
  const endTime = body.endTime;
  const type = body.type;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;

  if (!name) throw httpError('Name is required');
  if (!category) throw httpError('Category is required');
  if (!isDateKey(date)) throw httpError('Date must be YYYY-MM-DD');
  if (!isTimeKey(startTime) || !isTimeKey(endTime)) throw httpError('Times must be HH:mm');
  if (!ACTIVITY_TYPES.includes(type)) throw httpError('Invalid activity type');

  let endDate = body.endDate && isDateKey(body.endDate) ? body.endDate : undefined;
  if (!endDate && endTime <= startTime) endDate = addDays(date, 1);
  if (endDate === date) endDate = undefined;

  const durationMinutes = calculateDuration(startTime, endTime, date, endDate);
  if (durationMinutes <= 0) throw httpError('Duration must be greater than 0');

  return {
    name,
    category,
    date,
    startTime,
    endTime,
    endDate,
    durationMinutes,
    type,
    notes: notes || undefined,
  };
}

function buildGoalFields(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const targetMinutes = Number(body.targetMinutes);
  const date = body.date;
  const period = body.period;

  if (!name) throw httpError('Name is required');
  if (!isDateKey(date)) throw httpError('Date must be YYYY-MM-DD');
  if (!GOAL_PERIODS.includes(period)) throw httpError('Invalid goal period');
  if (!Number.isFinite(targetMinutes) || targetMinutes < 1) {
    throw httpError('Target minutes must be at least 1');
  }

  return {
    name,
    category: category || undefined,
    targetMinutes: Math.round(targetMinutes),
    date,
    period,
  };
}

function buildHabitFields(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const targetDaysPerWeek = Number(body.targetDaysPerWeek);
  const color = typeof body.color === 'string' ? body.color.trim() : '#0d9488';
  const completedDates = Array.isArray(body.completedDates)
    ? [...new Set(body.completedDates.filter(isDateKey))].sort()
    : undefined;

  if (!name) throw httpError('Name is required');
  if (!Number.isFinite(targetDaysPerWeek) || targetDaysPerWeek < 1 || targetDaysPerWeek > 7) {
    throw httpError('Target days per week must be between 1 and 7');
  }

  const fields = {
    name,
    description: description || undefined,
    targetDaysPerWeek: Math.round(targetDaysPerWeek),
    color: color || '#0d9488',
  };
  if (completedDates) fields.completedDates = completedDates;
  return fields;
}

function defaultSettings() {
  return {
    sleepTargetMinutes: 480,
    displayName: 'You',
    theme: 'system',
  };
}

function sanitizeGritRows(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const cleaned = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = typeof row.id === 'string' ? row.id.trim().slice(0, 80) : '';
    const subject = typeof row.subject === 'string' ? row.subject.trim().slice(0, 160) : '';
    const level = Number(row.level);
    if (!id || !subject || !Number.isFinite(level) || level < 1 || level > 10) continue;
    const key = `${Math.round(level)}::${subject}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      id,
      level: Math.round(level),
      subject,
      result: GRIT_RESULTS.includes(row.result) ? row.result : 'none',
      target: GRIT_TARGETS.includes(row.target) ? row.target : 'gold',
      inClimb: Boolean(row.inClimb),
      position: Number.isFinite(Number(row.position)) ? Math.max(0, Math.round(Number(row.position))) : 0,
    });
  }
  return cleaned;
}

function newId() {
  return require('crypto').randomUUID();
}

function sanitizeAcademicSubs(subs, depth = 0) {
  if (!Array.isArray(subs) || depth > 4) return [];
  return subs
    .map((node) => ({
      id: String(node?.id || newId()).slice(0, 80),
      title: String(node?.title || '').trim().slice(0, 200),
      done: Boolean(node?.done),
      subs: sanitizeAcademicSubs(node?.subs, depth + 1),
    }))
    .filter((node) => node.title);
}

function mapAcademicSubs(subs) {
  if (!Array.isArray(subs)) return [];
  return subs.map((node) => ({
    id: node.id,
    title: node.title,
    done: Boolean(node.done),
    subs: mapAcademicSubs(node.subs),
  }));
}

function sanitizeAcademicTracks(tracks) {
  if (!Array.isArray(tracks)) return [];
  return tracks.slice(0, 20).map((track) => ({
    id: String(track?.id || newId()).slice(0, 80),
    name: String(track?.name || 'Semester').trim().slice(0, 120) || 'Semester',
    subjects: Array.isArray(track?.subjects)
      ? track.subjects.slice(0, 40).map((subject) => ({
          id: String(subject?.id || newId()).slice(0, 80),
          name: String(subject?.name || '').trim().slice(0, 200) || 'Subject',
          stars: Math.min(5, Math.max(1, Number(subject?.stars) || 3)),
          subs: sanitizeAcademicSubs(subject?.subs),
        }))
      : [],
  }));
}

function mapAcademicTracks(tracks) {
  return (tracks || []).map((track) => ({
    id: track.id,
    name: track.name,
    subjects: (track.subjects || []).map((subject) => ({
      id: subject.id,
      name: subject.name,
      stars: subject.stars,
      subs: mapAcademicSubs(subject.subs),
    })),
  }));
}

function newProgressId() {
  return require('crypto').randomUUID();
}

function sanitizeProgress(payload) {
  const intention = String(payload?.intention || '').trim().slice(0, 200);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const dueOk = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  return {
    intention,
    focusMinutesToday: Math.max(0, Math.round(Number(payload?.focusMinutesToday) || 0)),
    focusDate: dueOk(payload?.focusDate) ? String(payload.focusDate) : '',
    items: items.slice(0, 40).map((item, index) => ({
      id: String(item?.id || newProgressId()).slice(0, 80),
      title: String(item?.title || '').trim().slice(0, 160) || 'Focus',
      note: String(item?.note || '').trim().slice(0, 400),
      percent: Math.min(100, Math.max(0, Math.round(Number(item?.percent) || 0))),
      done: Boolean(item?.done),
      position: Number.isFinite(Number(item?.position)) ? Math.max(0, Math.round(Number(item.position))) : index,
      source: String(item?.source || 'Custom').trim().slice(0, 80) || 'Custom',
      due: dueOk(item?.due) ? String(item.due) : '',
      minutes: Math.max(0, Math.round(Number(item?.minutes) || 0)),
    })),
  };
}

function mapProgress(doc) {
  return {
    intention: doc?.intention || '',
    focusMinutesToday: doc?.focusMinutesToday || 0,
    focusDate: doc?.focusDate || '',
    items: (doc?.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      note: item.note || '',
      percent: item.percent,
      done: Boolean(item.done),
      position: item.position,
      source: item.source || 'Custom',
      due: item.due || '',
      minutes: item.minutes || 0,
    })),
  };
}

async function getGrit(userId) {
  const doc = await UserGrit.findOne({ user: userId });
  return doc?.rows ? doc.rows.map((row) => ({
    id: row.id,
    level: row.level,
    subject: row.subject,
    result: row.result,
    target: row.target,
    inClimb: row.inClimb,
    position: row.position,
  })) : [];
}

async function saveGrit(userId, rows) {
  const cleaned = sanitizeGritRows(rows);
  const doc = await UserGrit.findOneAndUpdate(
    { user: userId },
    { user: userId, rows: cleaned },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return doc.rows.map((row) => ({
    id: row.id,
    level: row.level,
    subject: row.subject,
    result: row.result,
    target: row.target,
    inClimb: row.inClimb,
    position: row.position,
  }));
}

async function getAcademics(userId) {
  const doc = await UserAcademics.findOne({ user: userId });
  return mapAcademicTracks(doc?.tracks);
}

async function saveAcademics(userId, tracks) {
  const cleaned = sanitizeAcademicTracks(tracks);
  const doc = await UserAcademics.findOneAndUpdate(
    { user: userId },
    { user: userId, tracks: cleaned },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return mapAcademicTracks(doc.tracks);
}

async function getProgress(userId) {
  const doc = await UserProgress.findOne({ user: userId });
  return mapProgress(doc);
}

async function saveProgress(userId, payload) {
  const cleaned = sanitizeProgress(payload);
  const doc = await UserProgress.findOneAndUpdate(
    { user: userId },
    { user: userId, ...cleaned },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return mapProgress(doc);
}

async function getSnapshot(userId) {
  const [activities, goals, habits, settingsDoc, grit, academics, progress] = await Promise.all([
    Activity.find({ user: userId }).sort({ date: -1, startTime: 1 }),
    Goal.find({ user: userId }).sort({ date: -1 }),
    Habit.find({ user: userId }).sort({ createdAt: 1 }),
    UserSettings.findOne({ user: userId }),
    getGrit(userId),
    getAcademics(userId),
    getProgress(userId),
  ]);

  return {
    activities: toClientList(activities),
    goals: toClientList(goals),
    habits: toClientList(habits),
    settings: settingsDoc ? toClient(settingsDoc) : defaultSettings(),
    grit,
    academics,
    progress,
  };
}

async function clearAll(userId) {
  await Promise.all([
    Activity.deleteMany({ user: userId }),
    Goal.deleteMany({ user: userId }),
    Habit.deleteMany({ user: userId }),
    UserGrit.deleteMany({ user: userId }),
    UserAcademics.deleteMany({ user: userId }),
    UserProgress.deleteMany({ user: userId }),
  ]);
}

async function importSnapshot(userId, payload = {}) {
  const created = { activities: [], goals: [], habits: [], grit: [], academics: [], progress: null };

  if (Array.isArray(payload.activities) && payload.activities.length) {
    const docs = payload.activities.map((item) => ({
      user: userId,
      ...withOptionalId(buildActivityFields(item), item),
    }));
    const inserted = await Activity.insertMany(docs);
    created.activities = toClientList(inserted);
  }

  if (Array.isArray(payload.goals) && payload.goals.length) {
    const docs = payload.goals.map((item) => ({
      user: userId,
      ...withOptionalId(buildGoalFields(item), item),
    }));
    const inserted = await Goal.insertMany(docs);
    created.goals = toClientList(inserted);
  }

  if (Array.isArray(payload.habits) && payload.habits.length) {
    const docs = payload.habits.map((item) => ({
      user: userId,
      ...withOptionalId(buildHabitFields({ ...item, completedDates: item.completedDates || [] }), item),
    }));
    const inserted = await Habit.insertMany(docs);
    created.habits = toClientList(inserted);
  }

  if (payload.settings && typeof payload.settings === 'object') {
    created.settings = await upsertSettings(userId, payload.settings);
  }

  const gritRows = Array.isArray(payload.grit) ? payload.grit : payload.grit?.rows;
  if (Array.isArray(gritRows) && gritRows.length) {
    created.grit = await saveGrit(userId, gritRows);
  }

  const academicTracks = Array.isArray(payload.academics)
    ? payload.academics
    : payload.academics?.tracks;
  if (Array.isArray(academicTracks) && academicTracks.length) {
    created.academics = await saveAcademics(userId, academicTracks);
  }

  if (payload.progress && typeof payload.progress === 'object') {
    created.progress = await saveProgress(userId, payload.progress);
  }

  return created;
}

async function listActivities(userId) {
  const docs = await Activity.find({ user: userId }).sort({ date: -1, startTime: 1 });
  return toClientList(docs);
}

async function createActivity(userId, body) {
  const doc = await Activity.create({
    user: userId,
    ...withOptionalId(buildActivityFields(body), body),
  });
  return toClient(doc);
}

async function updateActivity(userId, id, body) {
  const doc = requireOwned(await Activity.findOne({ _id: id, user: userId }));
  Object.assign(doc, buildActivityFields(body));
  await doc.save();
  return toClient(doc);
}

async function deleteActivity(userId, id) {
  const doc = requireOwned(await Activity.findOneAndDelete({ _id: id, user: userId }));
  return toClient(doc);
}

async function listGoals(userId) {
  const docs = await Goal.find({ user: userId }).sort({ date: -1 });
  return toClientList(docs);
}

async function createGoal(userId, body) {
  const doc = await Goal.create({
    user: userId,
    ...withOptionalId(buildGoalFields(body), body),
  });
  return toClient(doc);
}

async function updateGoal(userId, id, body) {
  const doc = requireOwned(await Goal.findOne({ _id: id, user: userId }));
  Object.assign(doc, buildGoalFields(body));
  await doc.save();
  return toClient(doc);
}

async function deleteGoal(userId, id) {
  const doc = requireOwned(await Goal.findOneAndDelete({ _id: id, user: userId }));
  return toClient(doc);
}

async function listHabits(userId) {
  const docs = await Habit.find({ user: userId }).sort({ createdAt: 1 });
  return toClientList(docs);
}

async function createHabit(userId, body) {
  const fields = buildHabitFields({ ...body, completedDates: body.completedDates || [] });
  const doc = await Habit.create({
    user: userId,
    ...withOptionalId(fields, body),
  });
  return toClient(doc);
}

async function updateHabit(userId, id, body) {
  const doc = requireOwned(await Habit.findOne({ _id: id, user: userId }));
  const fields = buildHabitFields({
    ...body,
    completedDates: body.completedDates ?? doc.completedDates,
    color: body.color ?? doc.color,
  });
  Object.assign(doc, fields);
  await doc.save();
  return toClient(doc);
}

async function toggleHabit(userId, id, date) {
  if (!isDateKey(date)) throw httpError('Date must be YYYY-MM-DD');
  const doc = requireOwned(await Habit.findOne({ _id: id, user: userId }));
  const has = doc.completedDates.includes(date);
  doc.completedDates = has
    ? doc.completedDates.filter((d) => d !== date)
    : [...doc.completedDates, date].sort();
  await doc.save();
  return toClient(doc);
}

async function deleteHabit(userId, id) {
  const doc = requireOwned(await Habit.findOneAndDelete({ _id: id, user: userId }));
  return toClient(doc);
}

async function getSettings(userId) {
  const doc = await UserSettings.findOne({ user: userId });
  return doc ? toClient(doc) : defaultSettings();
}

async function upsertSettings(userId, body = {}) {
  const current = (await UserSettings.findOne({ user: userId })) || {};
  const sleepTargetMinutes = Number(
    body.sleepTargetMinutes != null ? body.sleepTargetMinutes : current.sleepTargetMinutes || 480
  );
  const displayName =
    typeof body.displayName === 'string' && body.displayName.trim()
      ? body.displayName.trim()
      : current.displayName || 'You';
  const theme = THEMES.includes(body.theme) ? body.theme : current.theme || 'system';

  if (!Number.isFinite(sleepTargetMinutes) || sleepTargetMinutes < 240 || sleepTargetMinutes > 840) {
    throw httpError('Sleep target must be between 4 and 14 hours');
  }

  const doc = await UserSettings.findOneAndUpdate(
    { user: userId },
    {
      user: userId,
      sleepTargetMinutes: Math.round(sleepTargetMinutes),
      displayName,
      theme,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return toClient(doc);
}

module.exports = {
  getSnapshot,
  clearAll,
  importSnapshot,
  listActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  listHabits,
  createHabit,
  updateHabit,
  toggleHabit,
  deleteHabit,
  getSettings,
  upsertSettings,
  getGrit,
  saveGrit,
  getAcademics,
  saveAcademics,
  getProgress,
  saveProgress,
};
