const data = require('../services/data.service');

function userId(req) {
  return req.user._id;
}

async function snapshot(req, res, next) {
  try {
    res.json(await data.getSnapshot(userId(req)));
  } catch (err) {
    next(err);
  }
}

async function clearAll(req, res, next) {
  try {
    await data.clearAll(userId(req));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function importSnapshot(req, res, next) {
  try {
    const created = await data.importSnapshot(userId(req), req.body || {});
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function listActivities(req, res, next) {
  try {
    res.json(await data.listActivities(userId(req)));
  } catch (err) {
    next(err);
  }
}

async function createActivity(req, res, next) {
  try {
    res.status(201).json(await data.createActivity(userId(req), req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function updateActivity(req, res, next) {
  try {
    res.json(await data.updateActivity(userId(req), req.params.id, req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function deleteActivity(req, res, next) {
  try {
    res.json(await data.deleteActivity(userId(req), req.params.id));
  } catch (err) {
    next(err);
  }
}

async function listGoals(req, res, next) {
  try {
    res.json(await data.listGoals(userId(req)));
  } catch (err) {
    next(err);
  }
}

async function createGoal(req, res, next) {
  try {
    res.status(201).json(await data.createGoal(userId(req), req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function updateGoal(req, res, next) {
  try {
    res.json(await data.updateGoal(userId(req), req.params.id, req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function deleteGoal(req, res, next) {
  try {
    res.json(await data.deleteGoal(userId(req), req.params.id));
  } catch (err) {
    next(err);
  }
}

async function listHabits(req, res, next) {
  try {
    res.json(await data.listHabits(userId(req)));
  } catch (err) {
    next(err);
  }
}

async function createHabit(req, res, next) {
  try {
    res.status(201).json(await data.createHabit(userId(req), req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function updateHabit(req, res, next) {
  try {
    res.json(await data.updateHabit(userId(req), req.params.id, req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function toggleHabit(req, res, next) {
  try {
    const date = req.body?.date;
    res.json(await data.toggleHabit(userId(req), req.params.id, date));
  } catch (err) {
    next(err);
  }
}

async function deleteHabit(req, res, next) {
  try {
    res.json(await data.deleteHabit(userId(req), req.params.id));
  } catch (err) {
    next(err);
  }
}

async function getSettings(req, res, next) {
  try {
    res.json(await data.getSettings(userId(req)));
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    res.json(await data.upsertSettings(userId(req), req.body || {}));
  } catch (err) {
    next(err);
  }
}

async function getGrit(req, res, next) {
  try {
    res.json({ rows: await data.getGrit(userId(req)) });
  } catch (err) {
    next(err);
  }
}

async function saveGrit(req, res, next) {
  try {
    const rows = Array.isArray(req.body) ? req.body : req.body?.rows;
    res.json({ rows: await data.saveGrit(userId(req), rows) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  snapshot,
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
  updateSettings,
  getGrit,
  saveGrit,
};
