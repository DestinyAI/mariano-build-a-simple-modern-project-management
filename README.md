# TeamFlow

A clean, fast project management workspace for small teams: projects with progress,
a Kanban board with drag and drop, tasks with priorities, labels, comments and
subtasks, a users module for the team directory, and a monthly roadmap.
Expo SDK 54 + Expo Router, exported as a static web app.

## Users module (Team tab)

The **Team** tab is the users module. Members live in the same shared database as
everything else, so the directory every teammate assigns work from is identical:

- create, edit, deactivate/reactivate and delete members;
- each member has a name, email, role (**Owner / Admin / Member / Viewer**),
  avatar initials and an accent colour;
- per-member workload — assigned, in progress, completed and overdue counts,
  plus a completion bar and the projects they own;
- **acting as**: pick which member this browser is you. New tasks, comments and
  activity entries are attributed to that member. The choice itself is stored
  locally (`teamflow:current-member`) because it is a per-device preference, not
  shared state;
- deactivated members keep all of their history but drop out of the assignee
  pickers on the board and in the task sheet; deleting one unassigns their tasks
  and clears their project ownership instead of deleting the work.

## Where the data lives (design decision, not a missing feature)

TeamFlow has one data layer with two modes, and the app always tells you which
one you are in — look at the badge in the sidebar and the panel at the top of the
Dashboard.

| Mode | When | Behaviour |
| --- | --- | --- |
| **Local workspace** | No Data API env vars in the build | Everything is persisted with AsyncStorage. It survives reloads, but it lives in *that* browser only — a teammate opening the same link starts with an empty board. |
| **Shared cloud workspace** | `EXPO_PUBLIC_DATA_API_URL` + `EXPO_PUBLIC_DATA_API_AUTH_URL` are set | The same screens read and write a shared Postgres database through its PostgREST-style Data API. It is pulled on boot, polled every 20s, and every write is mirrored to it, so the whole team sees the same board. |

There is no separate backend service to run: the Data API *is* the backend, and
the app talks to it directly with a short-lived anonymous token (fetched from the
auth URL, cached in memory, refreshed automatically on `401`).

The local mode is deliberate, not a bug: a public static build cannot ship
database credentials that are meant to stay private, so with no Data API
configured the app degrades to device-local storage instead of pretending to
sync. Writes made while the cloud is unreachable stay queued in memory and
upload on the next successful call — the Dashboard panel shows the pending
count and offers **Retry sync**.

### Enabling the shared database

1. Create a Postgres database with a Data API (e.g. Neon Data API) and apply
   [`db/schema.sql`](db/schema.sql) — it creates the six tables
   (`projects`, `tasks`, `subtasks`, `comments`, `members`, `activities`) and
   grants the anonymous role access to them. The script is idempotent and also
   upgrades a database created before the users module existed (it adds
   `members.email/role/active/created_at` and `projects.owner_id`).
2. Copy `.env.example` to `.env` (locally) or set the same two variables in the
   hosting project's environment (Vercel → Settings → Environment Variables).
3. Rebuild. `EXPO_PUBLIC_*` values are inlined at build time, so a redeploy is
   required for them to take effect — the sidebar badge should flip from
   *Local only* to *Cloud synced*.

Column names in the database are `snake_case`; TypeScript models stay
`camelCase` and are converted only in `src/cloud.ts`.

## The live link

The web build is a static export, deployed from this repository:

```bash
npm install
npx expo export --platform web   # writes ./dist
```

`vercel.json` (`cleanUrls`) serves `dist/` as the site, so the live URL is the
Vercel deployment attached to this repo — every push to `main` that is deployed
publishes the current `dist` output. Run it locally with:

```bash
npm run web
```

## Project layout

```
app/_layout.tsx        persistent sidebar / bottom nav + workspace provider
app/(tabs)/index.tsx   Dashboard: progress, stat tiles, activity feed, sync panel
app/(tabs)/projects.tsx  Projects CRUD
app/(tabs)/board.tsx     Kanban board with drag and drop + filters
app/(tabs)/roadmap.tsx   monthly timeline
app/(tabs)/team.tsx      Team: users module (members, roles, workload, acting as)
src/cloud.ts           shared cloud database client + connection status
src/storage.ts         AsyncStorage persistence, mirrored to the cloud
src/store.tsx          workspace state, mutations, activity log, polling
db/schema.sql          database schema for the shared mode
```
