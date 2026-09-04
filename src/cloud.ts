/**
 * Shared cloud database client (PostgREST-style Data API).
 *
 * TeamFlow keeps every collection in AsyncStorage so the app always works
 * offline and loads instantly, and mirrors those collections to a shared
 * cloud database when this deployment is configured with a Data API. When the
 * Data API is configured the cloud copy is the source of truth: it is pulled
 * on boot and polled while the app is open, so every teammate sees the same
 * projects, tasks, comments, team members and activity.
 *
 * Configuration is read from build-time public env vars:
 *   EXPO_PUBLIC_DATA_API_URL        e.g. https://<project>.supabase.co/rest/v1
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY   the project's anon/publishable key, sent as-is
 *                                   as the bearer token (Supabase needs no token exchange)
 * When they are absent the workspace simply stays local to the device — see
 * README.md and db/schema.sql.
 */
import { useEffect, useState } from 'react';
import {
  Activity,
  ActivityTargetType,
  Comment,
  MEMBER_ROLES,
  Member,
  MemberRole,
  PROJECT_STATUSES,
  Project,
  ProjectStatus,
  Subtask,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
} from './types';

/* ------------------------------------------------------------------- config */

function trimUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

const DATA_API_URL = trimUrl(process.env.EXPO_PUBLIC_DATA_API_URL);

/**
 * Supabase anon/publishable key. Sent straight through as the bearer token on
 * every Data API call — Supabase has no token-exchange endpoint to hit first.
 */
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

/** True when this build was given a shared cloud database to talk to. */
export const cloudEnabled: boolean = DATA_API_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/** Host shown in the UI so it is obvious *which* database is in use. */
export const cloudHost: string = cloudEnabled ? DATA_API_URL.replace(/^https?:\/\//, '').split('/')[0] : '';

/* ------------------------------------------------------------------- status */

export type CloudState = 'local' | 'connecting' | 'online' | 'offline';

export interface CloudStatus {
  state: CloudState;
  detail: string;
  lastSyncedAt: string | null;
  pendingWrites: number;
}

let status: CloudStatus = {
  state: cloudEnabled ? 'connecting' : 'local',
  detail: cloudEnabled
    ? `Connecting to ${cloudHost}…`
    : 'Saved in this browser only — no shared database is configured for this deployment.',
  lastSyncedAt: null,
  pendingWrites: 0,
};

type StatusListener = (next: CloudStatus) => void;
const listeners = new Set<StatusListener>();

function setStatus(patch: Partial<CloudStatus>): void {
  status = { ...status, ...patch };
  listeners.forEach(listener => listener(status));
}

export function getCloudStatus(): CloudStatus {
  return status;
}

export function subscribeCloudStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe a component to cloud connection/sync state. */
export function useCloudStatus(): CloudStatus {
  const [value, setValue] = useState<CloudStatus>(getCloudStatus);
  useEffect(() => subscribeCloudStatus(setValue), []);
  return value;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown network error';
}

/* -------------------------------------------------------------- http client */

/**
 * Supabase uses the project's anon/publishable key directly as the bearer token,
 * so this just hands back the configured key — there is no auth URL to call and
 * nothing to cache or refresh. Throws a clear error when the key is missing.
 */
function getAnonymousToken(): string {
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY is not set — cannot authenticate against the shared database. ' +
        'Add it to the build environment (see .env.example).',
    );
  }
  return SUPABASE_ANON_KEY;
}

async function dataApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAnonymousToken();
  return fetch(`${DATA_API_URL}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
}

/* ------------------------------------------------------------ row decoding */

function readRecord(value: unknown): Record<string, unknown> {
  // Rows arrive as untyped JSON; narrow once here so the codecs stay strict.
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(source: object, key: string, fallback = ''): string {
  const value = (source as Record<string, unknown>)[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function readNumber(row: Record<string, unknown>, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readBoolean(row: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = row[key];
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return fallback;
  return value === 'true' || value === 1;
}

function readStringArray(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value === 'string' && value.length > 0) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((entry): entry is string => typeof entry === 'string');
    } catch {
      // Postgres text[] literal form: {a,b}
      return value
        .replace(/^\{|\}$/g, '')
        .split(',')
        .map(entry => entry.replace(/^"|"$/g, '').trim())
        .filter(entry => entry.length > 0);
    }
  }
  return [];
}

function oneOf<T extends string>(options: readonly T[], value: string, fallback: T): T {
  return (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

const ACTIVITY_TARGETS: ActivityTargetType[] = ['project', 'task', 'member'];

/* -------------------------------------------------------------------- codecs */

export type CloudTable = 'projects' | 'tasks' | 'subtasks' | 'comments' | 'members' | 'activities';

export interface TableCodec<T> {
  table: CloudTable;
  order: string;
  toRow: (item: T) => Record<string, unknown>;
  fromRow: (row: Record<string, unknown>) => T;
}

export const projectCodec: TableCodec<Project> = {
  table: 'projects',
  order: 'created_at.asc',
  toRow: project => ({
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    color: project.color,
    start_date: project.startDate,
    target_date: project.targetDate,
    owner_id: project.ownerId,
    created_at: project.createdAt,
  }),
  fromRow: row => ({
    id: readString(row, 'id'),
    name: readString(row, 'name'),
    description: readString(row, 'description'),
    status: oneOf<ProjectStatus>(PROJECT_STATUSES, readString(row, 'status'), 'Planning'),
    color: readString(row, 'color'),
    startDate: readString(row, 'start_date'),
    targetDate: readString(row, 'target_date'),
    ownerId: readString(row, 'owner_id'),
    createdAt: readString(row, 'created_at'),
  }),
};

export const taskCodec: TableCodec<Task> = {
  table: 'tasks',
  order: 'created_at.asc',
  toRow: task => ({
    id: task.id,
    project_id: task.projectId,
    title: task.title,
    description: task.description,
    type: task.type,
    status: task.status,
    priority: task.priority,
    assignee_id: task.assigneeId,
    due_date: task.dueDate,
    labels: task.labels,
    sort_order: task.order,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  }),
  fromRow: row => ({
    id: readString(row, 'id'),
    projectId: readString(row, 'project_id'),
    title: readString(row, 'title'),
    description: readString(row, 'description'),
    type: oneOf<TaskType>(TASK_TYPES, readString(row, 'type'), 'Task'),
    status: oneOf<TaskStatus>(TASK_STATUSES, readString(row, 'status'), 'Backlog'),
    priority: oneOf<TaskPriority>(TASK_PRIORITIES, readString(row, 'priority'), 'Medium'),
    assigneeId: readString(row, 'assignee_id'),
    dueDate: readString(row, 'due_date'),
    labels: readStringArray(row, 'labels'),
    order: readNumber(row, 'sort_order'),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  }),
};

export const subtaskCodec: TableCodec<Subtask> = {
  table: 'subtasks',
  order: 'created_at.asc',
  toRow: subtask => ({
    id: subtask.id,
    task_id: subtask.taskId,
    title: subtask.title,
    done: subtask.done,
    created_at: subtask.createdAt,
  }),
  fromRow: row => ({
    id: readString(row, 'id'),
    taskId: readString(row, 'task_id'),
    title: readString(row, 'title'),
    done: readBoolean(row, 'done'),
    createdAt: readString(row, 'created_at'),
  }),
};

export const commentCodec: TableCodec<Comment> = {
  table: 'comments',
  order: 'created_at.asc',
  toRow: comment => ({
    id: comment.id,
    task_id: comment.taskId,
    author_id: comment.authorId,
    body: comment.body,
    created_at: comment.createdAt,
  }),
  fromRow: row => ({
    id: readString(row, 'id'),
    taskId: readString(row, 'task_id'),
    authorId: readString(row, 'author_id'),
    body: readString(row, 'body'),
    createdAt: readString(row, 'created_at'),
  }),
};

export const memberCodec: TableCodec<Member> = {
  table: 'members',
  order: 'name.asc',
  toRow: member => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    initials: member.initials,
    color: member.color,
    active: member.active,
    created_at: member.createdAt,
  }),
  fromRow: row => ({
    id: readString(row, 'id'),
    name: readString(row, 'name'),
    email: readString(row, 'email'),
    role: oneOf<MemberRole>(MEMBER_ROLES, readString(row, 'role'), 'Member'),
    initials: readString(row, 'initials'),
    color: readString(row, 'color'),
    // Rows written before the users module existed have no `active` column value.
    active: readBoolean(row, 'active', true),
    createdAt: readString(row, 'created_at'),
  }),
};

export const activityCodec: TableCodec<Activity> = {
  table: 'activities',
  order: 'created_at.desc',
  toRow: activity => ({
    id: activity.id,
    actor_id: activity.actorId,
    action: activity.action,
    target_type: activity.targetType,
    target_id: activity.targetId,
    target_title: activity.targetTitle,
    created_at: activity.createdAt,
  }),
  fromRow: row => ({
    id: readString(row, 'id'),
    actorId: readString(row, 'actor_id'),
    action: readString(row, 'action'),
    targetType: oneOf<ActivityTargetType>(ACTIVITY_TARGETS, readString(row, 'target_type'), 'task'),
    targetId: readString(row, 'target_id'),
    targetTitle: readString(row, 'target_title'),
    createdAt: readString(row, 'created_at'),
  }),
};

/* ------------------------------------------------------------------- reading */

export interface CloudSnapshot {
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  comments: Comment[];
  members: Member[];
  activities: Activity[];
}

async function selectAll<T>(codec: TableCodec<T>): Promise<T[]> {
  const res = await dataApiFetch(`/${codec.table}?select=*&order=${codec.order}`);
  if (!res.ok) throw new Error(`Could not read ${codec.table} (${res.status})`);
  const payload: unknown = await res.json();
  if (!Array.isArray(payload)) return [];
  return payload.map(entry => codec.fromRow(readRecord(entry)));
}

/**
 * Pull the whole shared workspace. Throws when the cloud is unreachable so the
 * caller can fall back to the local cache and show a real error state.
 */
export async function fetchCloudSnapshot(): Promise<CloudSnapshot> {
  const [projects, tasks, subtasks, comments, members, activities] = await Promise.all([
    selectAll(projectCodec),
    selectAll(taskCodec),
    selectAll(subtaskCodec),
    selectAll(commentCodec),
    selectAll(memberCodec),
    selectAll(activityCodec),
  ]);
  return { projects, tasks, subtasks, comments, members, activities };
}

/** Pull the shared workspace, tracking connection status. Null when offline/local. */
export async function pullWorkspace(): Promise<CloudSnapshot | null> {
  if (!cloudEnabled) return null;
  try {
    // Land any queued writes first so the snapshot we read includes them.
    await flushQueue();
    const snapshot = await fetchCloudSnapshot();
    setStatus({
      state: 'online',
      detail: `Shared with your team via ${cloudHost}`,
      lastSyncedAt: new Date().toISOString(),
    });
    return snapshot;
  } catch (error) {
    setStatus({ state: 'offline', detail: describeError(error) });
    return null;
  }
}

/* ------------------------------------------------------------------- writing */

type QueuedOp =
  | { kind: 'upsert'; table: CloudTable; rows: Record<string, unknown>[] }
  | { kind: 'delete'; table: CloudTable; ids: string[] };

/** Writes that could not reach the cloud yet; replayed on the next success. */
let queue: QueuedOp[] = [];

function trackQueue(): void {
  setStatus({ pendingWrites: queue.length });
}

async function runOp(op: QueuedOp): Promise<void> {
  if (op.kind === 'upsert') {
    const res = await dataApiFetch(`/${op.table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(op.rows),
    });
    if (!res.ok) throw new Error(`Could not save ${op.table} (${res.status})`);
    return;
  }
  const list = op.ids.map(id => `"${encodeURIComponent(id)}"`).join(',');
  const res = await dataApiFetch(`/${op.table}?id=in.(${list})`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Could not delete from ${op.table} (${res.status})`);
}

async function flushQueue(): Promise<void> {
  while (queue.length > 0) {
    const [next, ...rest] = queue;
    await runOp(next);
    queue = rest;
    trackQueue();
  }
}

async function submit(ops: QueuedOp[]): Promise<void> {
  if (!cloudEnabled || ops.length === 0) return;
  queue = [...queue, ...ops];
  trackQueue();
  try {
    await flushQueue();
    setStatus({
      state: 'online',
      detail: `Shared with your team via ${cloudHost}`,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (error) {
    // The local write already succeeded; keep the op queued and say so.
    setStatus({ state: 'offline', detail: describeError(error) });
  }
}

interface Identified {
  id: string;
}

/**
 * Mirror a collection change to the cloud by diffing the previous and next
 * local arrays — new/changed rows are upserted, removed rows are deleted.
 */
export async function pushCollection<T extends Identified>(
  codec: TableCodec<T>,
  previous: T[],
  next: T[],
): Promise<void> {
  if (!cloudEnabled) return;

  const beforeById = new Map(previous.map(item => [item.id, item]));
  const changed = next.filter(item => {
    const before = beforeById.get(item.id);
    return !before || JSON.stringify(codec.toRow(before)) !== JSON.stringify(codec.toRow(item));
  });
  const nextIds = new Set(next.map(item => item.id));
  const removedIds = previous.filter(item => !nextIds.has(item.id)).map(item => item.id);

  const ops: QueuedOp[] = [];
  if (changed.length > 0) ops.push({ kind: 'upsert', table: codec.table, rows: changed.map(codec.toRow) });
  if (removedIds.length > 0) ops.push({ kind: 'delete', table: codec.table, ids: removedIds });
  await submit(ops);
}

/** Retry queued writes and re-check the connection. */
export async function retryCloud(): Promise<void> {
  if (!cloudEnabled) return;
  setStatus({ state: 'connecting', detail: `Reconnecting to ${cloudHost}…` });
  try {
    await flushQueue();
    setStatus({
      state: 'online',
      detail: `Shared with your team via ${cloudHost}`,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (error) {
    setStatus({ state: 'offline', detail: describeError(error) });
  }
}
