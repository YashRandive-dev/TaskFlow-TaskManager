const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { emitToUsers } = require('../sockets');

const notify = async (userId, { type, message, link = '' }) => {
  if (!userId) return null;
  const n = await Notification.create({ user: userId, type, message, link });
  emitToUsers([userId], 'notification:new', n);
  return n;
};

const notifyMany = (userIds, payload, exclude) =>
  Promise.all(
    [...new Set(userIds.filter(Boolean).map(String))]
      .filter((id) => id !== String(exclude))
      .map((id) => notify(id, payload))
  );

const logActivity = ({ user, action, entity, entityId, project = null }) =>
  ActivityLog.create({ user, action, entity, entityId, project }).catch((e) =>
    console.error('activity log failed', e.message)
  );

module.exports = { notify, notifyMany, logActivity };
