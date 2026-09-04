/**
 * Workspace persistence.
 *
 * Every collection is written to AsyncStorage (instant load, works offline) and
 * mirrored to the shared cloud database when this deployment is configured with
 * a Data API — see src/cloud.ts. With the cloud configured it is the source of
 * truth: `loadWorkspace` prefers the cloud snapshot and refreshes the local
 * cache from it, so the whole team reads and writes the same rows.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as cloud from './cloud';
import { Activity, Comment, MEMBER_ROLES, Member, Project, Subtask, Task } from './types';

const KEYS = {
  projects: 'teamflow:projects',
  tasks: 'teamflow:tasks',
  subtasks: 'teamflow:subtasks',
  comments: 'teamflow:comments',
  members: 'teamflow:members',
  activities: 'teamflow:activities',
} as const;

/**
 * Which teammate this device is acting as. Deliberately device-local: the member
 * records themselves are shared, but "who am I" is a per-browser choice.
 */
const CURRENT_MEMBER_KEY = 'teamflow:current-member';

interface Identified {
  id: string;
}

async function readCollection<T extends Identified>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as T[];
  } catch {
    return [];
  }
}

async function writeCollection<T extends Identified>(key: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

/** Write locally, then mirror the diff to the shared cloud database. */
async function commit<T extends Identified>(
  key: string,
  codec: cloud.TableCodec<T>,
  previous: T[],
  next: T[],
): Promise<T[]> {
  await writeCollection(key, next);
  await cloud.pushCollection(codec, previous, next);
  return next;
}

/** Insert or replace by id, keeping the original position for updates. */
function upsert<T extends Identified>(items: T[], item: T): T[] {
  const index = items.findIndex(existing => existing.id === item.id);
  if (index === -1) return [...items, item];
  const next = items.slice();
  next[index] = item;
  return next;
}

/* ------------------------------------------------------------------ Projects */

/** Fills in fields added later for projects cached by an older build. */
function normalizeProject(project: Project): Project {
  return { ...project, ownerId: typeof project.ownerId === 'string' ? project.ownerId : '' };
}

export async function getAllProjects(): Promise<Project[]> {
  return (await readCollection<Project>(KEYS.projects)).map(normalizeProject);
}

export async function saveProject(project: Project): Promise<Project[]> {
  const previous = await getAllProjects();
  return commit(KEYS.projects, cloud.projectCodec, previous, upsert(previous, project));
}

export async function saveAllProjects(projects: Project[]): Promise<void> {
  await commit(KEYS.projects, cloud.projectCodec, await getAllProjects(), projects);
}

export async function removeProject(id: string): Promise<Project[]> {
  const previous = await getAllProjects();
  return commit(
    KEYS.projects,
    cloud.projectCodec,
    previous,
    previous.filter(project => project.id !== id),
  );
}

/* --------------------------------------------------------------------- Tasks */

export async function getAllTasks(): Promise<Task[]> {
  return readCollection<Task>(KEYS.tasks);
}

export async function saveTask(task: Task): Promise<Task[]> {
  const previous = await getAllTasks();
  return commit(KEYS.tasks, cloud.taskCodec, previous, upsert(previous, task));
}

export async function saveAllTasks(tasks: Task[]): Promise<void> {
  await commit(KEYS.tasks, cloud.taskCodec, await getAllTasks(), tasks);
}

export async function removeTask(id: string): Promise<Task[]> {
  const previous = await getAllTasks();
  return commit(
    KEYS.tasks,
    cloud.taskCodec,
    previous,
    previous.filter(task => task.id !== id),
  );
}

/* ------------------------------------------------------------------ Subtasks */

export async function getAllSubtasks(): Promise<Subtask[]> {
  return readCollection<Subtask>(KEYS.subtasks);
}

export async function saveSubtask(subtask: Subtask): Promise<Subtask[]> {
  const previous = await getAllSubtasks();
  return commit(KEYS.subtasks, cloud.subtaskCodec, previous, upsert(previous, subtask));
}

export async function saveAllSubtasks(subtasks: Subtask[]): Promise<void> {
  await commit(KEYS.subtasks, cloud.subtaskCodec, await getAllSubtasks(), subtasks);
}

export async function removeSubtask(id: string): Promise<Subtask[]> {
  const previous = await getAllSubtasks();
  return commit(
    KEYS.subtasks,
    cloud.subtaskCodec,
    previous,
    previous.filter(subtask => subtask.id !== id),
  );
}

/* ------------------------------------------------------------------ Comments */

export async function getAllComments(): Promise<Comment[]> {
  return readCollection<Comment>(KEYS.comments);
}

export async function saveComment(comment: Comment): Promise<Comment[]> {
  const previous = await getAllComments();
  return commit(KEYS.comments, cloud.commentCodec, previous, upsert(previous, comment));
}

export async function saveAllComments(comments: Comment[]): Promise<void> {
  await commit(KEYS.comments, cloud.commentCodec, await getAllComments(), comments);
}

export async function removeComment(id: string): Promise<Comment[]> {
  const previous = await getAllComments();
  return commit(
    KEYS.comments,
    cloud.commentCodec,
    previous,
    previous.filter(comment => comment.id !== id),
  );
}

/* ------------------------------------------------------------------- Members */

/** Fills in fields added by the users module for members cached before it existed. */
function normalizeMember(member: Member): Member {
  return {
    ...member,
    email: typeof member.email === 'string' ? member.email : '',
    role: MEMBER_ROLES.includes(member.role) ? member.role : 'Member',
    active: typeof member.active === 'boolean' ? member.active : true,
    createdAt: typeof member.createdAt === 'string' ? member.createdAt : '',
  };
}

export async function getAllMembers(): Promise<Member[]> {
  return (await readCollection<Member>(KEYS.members)).map(normalizeMember);
}

export async function getCurrentMemberId(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(CURRENT_MEMBER_KEY)) ?? '';
  } catch {
    return '';
  }
}

export async function setCurrentMemberId(id: string): Promise<void> {
  await AsyncStorage.setItem(CURRENT_MEMBER_KEY, id);
}

export async function saveMember(member: Member): Promise<Member[]> {
  const previous = await getAllMembers();
  return commit(KEYS.members, cloud.memberCodec, previous, upsert(previous, member));
}

export async function saveAllMembers(members: Member[]): Promise<void> {
  await commit(KEYS.members, cloud.memberCodec, await getAllMembers(), members);
}

export async function removeMember(id: string): Promise<Member[]> {
  const previous = await getAllMembers();
  return commit(
    KEYS.members,
    cloud.memberCodec,
    previous,
    previous.filter(member => member.id !== id),
  );
}

/* ---------------------------------------------------------------- Activities */

const MAX_ACTIVITIES = 120;

export async function getAllActivities(): Promise<Activity[]> {
  return readCollection<Activity>(KEYS.activities);
}

/** Newest first, capped so the feed cannot grow without bound. */
export async function saveActivity(activity: Activity): Promise<Activity[]> {
  const previous = await getAllActivities();
  const next = upsert(previous, activity)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ACTIVITIES);
  return commit(KEYS.activities, cloud.activityCodec, previous, next);
}

export async function saveAllActivities(activities: Activity[]): Promise<void> {
  await commit(
    KEYS.activities,
    cloud.activityCodec,
    await getAllActivities(),
    activities.slice(0, MAX_ACTIVITIES),
  );
}

export async function removeActivity(id: string): Promise<Activity[]> {
  const previous = await getAllActivities();
  return commit(
    KEYS.activities,
    cloud.activityCodec,
    previous,
    previous.filter(activity => activity.id !== id),
  );
}

/* ----------------------------------------------------------------- Workspace */

export interface WorkspaceSnapshot {
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  comments: Comment[];
  members: Member[];
  activities: Activity[];
}

async function loadLocalWorkspace(): Promise<WorkspaceSnapshot> {
  const [projects, tasks, subtasks, comments, members, activities] = await Promise.all([
    getAllProjects(),
    getAllTasks(),
    getAllSubtasks(),
    getAllComments(),
    getAllMembers(),
    getAllActivities(),
  ]);
  return { projects, tasks, subtasks, comments, members, activities };
}

async function cacheWorkspace(snapshot: WorkspaceSnapshot): Promise<void> {
  await Promise.all([
    writeCollection(KEYS.projects, snapshot.projects),
    writeCollection(KEYS.tasks, snapshot.tasks),
    writeCollection(KEYS.subtasks, snapshot.subtasks),
    writeCollection(KEYS.comments, snapshot.comments),
    writeCollection(KEYS.members, snapshot.members),
    writeCollection(KEYS.activities, snapshot.activities.slice(0, MAX_ACTIVITIES)),
  ]);
}

/**
 * Boot data: the shared cloud copy when it is configured and reachable,
 * otherwise the local cache (which keeps the app usable offline).
 */
export async function loadWorkspace(): Promise<WorkspaceSnapshot> {
  if (!cloud.cloudEnabled) return loadLocalWorkspace();
  const remote = await cloud.pullWorkspace();
  if (!remote) return loadLocalWorkspace();
  await cacheWorkspace(remote);
  return remote;
}

/** Re-read the shared workspace. Null when there is no cloud, or it is unreachable. */
export async function refreshWorkspace(): Promise<WorkspaceSnapshot | null> {
  const remote = await cloud.pullWorkspace();
  if (!remote) return null;
  await cacheWorkspace(remote);
  return remote;
}

export async function clearWorkspace(): Promise<void> {
  await AsyncStorage.multiRemove([...Object.values(KEYS), CURRENT_MEMBER_KEY]);
}
