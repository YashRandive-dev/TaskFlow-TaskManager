const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Project = require('../models/Project');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));
      const { id } = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = id;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    socket.join(`user:${socket.userId}`);
    try {
      const projects = await Project.find({ 'members.user': socket.userId }).select('_id');
      projects.forEach((p) => socket.join(`project:${p._id}`));
    } catch (e) {
      console.error('socket join error', e.message);
    }
    // Only members may join a project's room
    socket.on('project:join', async (id) => {
      try {
        if (await Project.exists({ _id: id, 'members.user': socket.userId })) socket.join(`project:${id}`);
      } catch { /* invalid id */ }
    });
  });

  return io;
};

const emitToUsers = (userIds, event, payload) => {
  if (!io) return;
  [...new Set(userIds.filter(Boolean).map(String))].forEach((id) => io.to(`user:${id}`).emit(event, payload));
};

const emitToProject = (projectId, event, payload) => {
  if (io && projectId) io.to(`project:${projectId}`).emit(event, payload);
};

/** Broadcast a task event to its creator, assignees and project room (one copy per socket). */
const broadcastTask = (task, event, payload = {}) => {
  if (!io) return;
  const ids = [task.createdBy, ...(task.assignees || [])].map((u) => u?._id || u).filter(Boolean).map((id) => `user:${id}`);
  const projectId = task.project?._id || task.project;
  const rooms = [...new Set(projectId ? [...ids, `project:${projectId}`] : ids)];
  if (rooms.length) io.to(rooms).emit(event, payload); // socket.io de-duplicates sockets across rooms
};

/** Remove a user's live connections from a project room (after leaving or being removed). */
const leaveProjectRoom = (userId, projectId) => {
  if (io) io.in(`user:${userId}`).socketsLeave(`project:${projectId}`);
};

/** Put a user's live connections into a project room (after being added). */
const joinProjectRoom = (userId, projectId) => {
  if (io) io.in(`user:${userId}`).socketsJoin(`project:${projectId}`);
};

module.exports = { initSocket, emitToUsers, emitToProject, broadcastTask, leaveProjectRoom, joinProjectRoom };
