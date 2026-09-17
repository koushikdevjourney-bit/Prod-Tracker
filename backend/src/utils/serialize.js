function toClient(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject({ versionKey: false }) : { ...doc };
  if (o._id != null) o._id = String(o._id);
  delete o.user;
  delete o.__v;
  if (o.createdAt instanceof Date) o.createdAt = o.createdAt.toISOString();
  if (o.updatedAt instanceof Date) o.updatedAt = o.updatedAt.toISOString();
  return o;
}

function toClientList(docs) {
  return (docs || []).map(toClient);
}

module.exports = { toClient, toClientList };
