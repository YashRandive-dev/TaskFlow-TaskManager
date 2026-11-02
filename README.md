# TaskFlow: MERN Task Manager

Steel Blue `#3B6EA8` · Terracotta `#C8553D` · Sage `#3E9B73` on graphite neutrals

```
TaskManager/
├── server/                 Express + MongoDB API (JavaScript, CommonJS)
│   └── src/
│       ├── app.js · server.js          app setup, HTTP + Socket.io + cron boot
│       ├── models/                     User, Session, Otp, Project, Task, Comment, Notification, ActivityLog
│       ├── controllers/                auth, user, task, project, misc (analytics + notifications)
│       ├── routes/index.js             all REST routes + express-validator rules
│       ├── middleware/index.js         protect (JWT), validate, notFound, errorHandler
│       ├── sockets/index.js            real-time rooms + broadcast helpers
│       ├── jobs/reminders.js           node-cron: email/in-app reminders for tasks due in 24h
│       └── utils/                      helpers, email (Nodemailer), upload (multer + Cloudinary/local), notify
└── client/                 React 18 + Vite + Tailwind + Framer Motion
    └── src/
        ├── api/axios.js                Axios + JWT refresh interceptor
        ├── context/                    Auth, Theme, Task, Notification, UI
        ├── components/{ui,layout,tasks}
        ├── pages/                      Landing, Auth, Dashboard, Tasks, Projects, ProjectDetail,
        │                               Focus, Notifications, Profile, Settings, Trash, NotFound
        └── utils/                      constants, helpers, nlp (quick-add parser)
```

## Run it

Requires Node 18+ and a MongoDB instance.

```bash
# 1. API
cd server
cp .env.example .env        # already created for local dev; set real secrets for production
npm install
npm run dev                 # http://localhost:5001

# 2. Web app (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173  (proxies /api, /uploads, /socket.io to :5001)
```

> Port 5000 is used by AirPlay Receiver on macOS, so the API defaults to **5001**.

### Optional services
- **Email** (password reset, invites, reminders): set `SMTP_*` in `server/.env`. Without it, emails are printed to the server console.
- **Cloudinary** (avatars/attachments): set `CLOUDINARY_*`. Without it, files are saved to `server/uploads/`.

## API summary
`{ success, data, message }` everywhere; central error handler + async wrapper.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register · login · logout · refresh · forgot-password · reset-password/:token` |
| Users | `GET/PUT /api/users/me` (multipart for avatar), `GET /api/users/search` |
| Tasks | `GET/POST /api/tasks` (filters: `search status priority category project assignee due from to sort order page limit archived trash`), `GET/PUT/DELETE /api/tasks/:id`, `PATCH /:id/status`, `PATCH /reorder`, `PATCH /:id/archive · restore · time`, `GET/POST /:id/comments`, `POST /:id/attachments`, `GET /:id/activity`, `GET /export?format=csv\|json`, `DELETE /trash/empty` |
| Projects | `GET/POST /api/projects`, `GET/PUT/DELETE /:id`, `POST /:id/invite`, `PUT/DELETE /:id/members/:userId`, `GET /:id/activity` |
| Other | `GET /api/analytics/summary`, `GET/PATCH/DELETE /api/notifications` |

## Keyboard shortcuts
`N` new task · `/` search · `K` Kanban · `L` list · `C` calendar · `F` focus mode · `D` dashboard · `?` help

## Notes
- Access token (15 min) + refresh token (7 days) are set as httpOnly cookies; the access token is also returned in the body for the Axios `Authorization` header and the Socket.io handshake. The interceptor transparently refreshes on 401.
- Deleting a task is a soft delete (Trash) with a 5-second **Undo** toast; "Delete forever" removes it permanently.
- Recurring tasks spawn the next occurrence when the current one is marked Done.

## Onboarding and personalisation
- After sign-up, new users choose their use cases (Work, Study, Health, Shopping, Personal). Categories and features follow that choice: Projects need Work, the focus timer needs Work or Study.
- A short profile setup (photo, role, organisation, location, bio) follows and can be skipped; the dashboard keeps suggesting it until it is filled in.
- **New task** opens a small composer: title, task type (Today, Daily, Weekly, Monthly, Scheduled, No date), category and priority, plus suggestions based on your use cases. Everything else lives under "More options" when editing a task.
- Settings include use cases, theme, time zone, week start, time format, default view/priority, daily goal, notifications, categories, data export and account deletion.

## Authentication (email codes)
- **Sign up** creates the account and emails a 6-digit code; the account is signed in only after the email is verified.
- **Log in** with email and password only. The code is used for first-time email verification and for password recovery.
- **Forgot password**: email, then code, then new password. Resetting signs out every device.
- Codes expire after 10 minutes, allow 5 wrong attempts, and can be re-sent after 30 seconds.
- **Devices** (Settings): each sign-in is a named session (for example "Chrome on macOS") that can be renamed or signed out. `MAX_DEVICES` (default 5) limits how many can be signed in at once; the least recently used is signed out when it is exceeded.
- Without `SMTP_*` configured, emails (including the codes) are printed to the server console, so you can sign up locally.

## Rate limits
Auth endpoints allow 40 requests per 15 minutes per IP by default. Set `AUTH_RATE_LIMIT` in `server/.env` to change it (useful for automated tests).

## Deploying on Render
The repository ships a `render.yaml` Blueprint. One web service builds the React app and serves it together with the API, so there is a single address (this avoids cross-site cookie problems).

- Build command: `npm run build` · Start command: `npm start` · Health check: `/api/health`
- Works with Root Directory empty or set to `server`; Node 20 is pinned in `package.json`.
- Required environment variables: `NODE_ENV=production`, `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL` (your Render address).
- Optional: `SMTP_*` for real emails, `CLOUDINARY_*` for persistent uploads (Render's disk is wiped on every deploy).
- MongoDB Atlas must allow Render's IPs (Network Access, for example `0.0.0.0/0`).

## Security notes
- Uploaded files are served with `nosniff` and a sandbox policy; only PNG/JPG/GIF/WebP render inline, everything else downloads.
- Emails escape user-supplied text. Auth endpoints are rate limited; codes lock after 5 wrong attempts.
- Never commit `server/.env`; use `server/.env.example` as the template.

