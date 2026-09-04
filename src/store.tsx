import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './auth';
import * as cloud from './cloud';
import { todayISO } from './dates';
import * as storage from './storage';
import { MEMBER_COLORS, PROJECT_COLORS } from './theme';
import {
  Activity,
  ActivityTargetType,
  Comment,
  Member,
  MemberRole,
  Project,
  ProjectStatus,
  Subtask,
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
  createId,
} from './types';

export interface ProjectDraft {
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  startDate: string;
  targetDate: string;
  ownerId: string;
}

export interface MemberDraft {
  name: string;
  email: string;
  role: MemberRole;
  color: string;
  active: boolean;
}

export interface TaskDraft {
  projectId: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  labels: string[];
}

export interface WorkspaceValue {
  ready: boolean;
  /** True when this deployment is wired to the shared cloud database. */
  cloudEnabled: boolean;
  refreshing: boolean;
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  comments: Comment[];
  members: Member[];
  activities: Activity[];
  currentMemberId: string;
  createProject: (draft: ProjectDraft) => Promise<void>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  createTask: (draft: TaskDraft) => Promise<void>;
  updateTask: (task: Task, action?: string) => Promise<void>;
  moveTask: (id: string, status: TaskStatus) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (id: string) => Promise<void>;
  deleteSubtask: (id: string) => Promise<void>;
  addComment: (taskId: string, body: string) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  createMember: (draft: MemberDraft) => Promise<void>;
  updateMember: (member: Member) => Promise<void>;
  setMemberActive: (id: string, active: boolean) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  /** Choose which teammate this device is acting as. */
  setCurrentMember: (id: string) => Promise<void>;
  /** Pull the shared workspace again (and replay any queued cloud writes). */
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/** How often the shared cloud workspace is re-read while the app is open. */
const POLL_INTERVAL_MS = 20000;

export function initialsFor(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(part => part.length > 0);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function nextOrder(tasks: Task[], status: TaskStatus): number {
  const inColumn = tasks.filter(task => task.status === status);
  if (inColumn.length === 0) return 0;
  return Math.max(...inColumn.map(task => task.order)) + 1;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const currentMemberIdRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async (): Promise<void> => {
      const [snapshot, savedMemberId] = await Promise.all([
        storage.loadWorkspace(),
        storage.getCurrentMemberId(),
      ]);
      if (cancelled) return;
      let team = snapshot.members;
      if (team.length === 0) {
        // Bootstrap the first teammate so work can be assigned and activity attributed.
        team = [
          {
            id: 'me',
            name: 'You',
            email: '',
            role: 'Owner',
            initials: 'YO',
            color: MEMBER_COLORS[0],
            active: true,
            createdAt: new Date().toISOString(),
          },
        ];
        await storage.saveAllMembers(team);
      }

      // Tie the signed-in account to a workspace member so "acting as" matches the login.
      let self: Member | undefined;
      if (user) {
        self = team.find(member => member.name === user.displayName);
        if (!self) {
          const created: Member = {
            id: createId(),
            name: user.displayName,
            email: '',
            role: user.role === 'admin' ? 'Admin' : 'Member',
            initials: initialsFor(user.displayName),
            color: MEMBER_COLORS[team.length % MEMBER_COLORS.length],
            active: true,
            createdAt: new Date().toISOString(),
          };
          team = await storage.saveMember(created);
          self = created;
        }
      }
      if (!self) {
        self =
          team.find(member => member.id === savedMemberId) ??
          team.find(member => member.id === 'me' && member.active) ??
          team.find(member => member.active) ??
          team[0];
      }
      currentMemberIdRef.current = self.id;
      setCurrentMemberId(self.id);
      if (self.id !== savedMemberId) await storage.setCurrentMemberId(self.id);
      setProjects(snapshot.projects);
      setTasks(snapshot.tasks);
      setSubtasks(snapshot.subtasks);
      setComments(snapshot.comments);
      setMembers(team);
      setActivities(snapshot.activities);
      setReady(true);
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!cloud.cloudEnabled) return;
    setRefreshing(true);
    try {
      const snapshot = await storage.refreshWorkspace();
      if (!snapshot) return;
      setProjects(snapshot.projects);
      setTasks(snapshot.tasks);
      setSubtasks(snapshot.subtasks);
      setComments(snapshot.comments);
      setActivities(snapshot.activities);
      if (snapshot.members.length > 0) {
        setMembers(snapshot.members);
        // A teammate may have been removed elsewhere — keep "acting as" valid.
        const stillThere = snapshot.members.some(member => member.id === currentMemberIdRef.current);
        if (!stillThere) {
          const replacement = snapshot.members.find(member => member.active) ?? snapshot.members[0];
          currentMemberIdRef.current = replacement.id;
          setCurrentMemberId(replacement.id);
          await storage.setCurrentMemberId(replacement.id);
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Poll the shared database so a teammate's changes show up without a reload.
  useEffect(() => {
    if (!cloud.cloudEnabled || !ready) return;
    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ready, refresh]);

  const log = useCallback(
    async (action: string, targetType: ActivityTargetType, targetId: string, targetTitle: string) => {
      const activity: Activity = {
        id: createId(),
        actorId: currentMemberIdRef.current,
        action,
        targetType,
        targetId,
        targetTitle,
        createdAt: new Date().toISOString(),
      };
      setActivities(await storage.saveActivity(activity));
    },
    [],
  );

  const createProject = useCallback(
    async (draft: ProjectDraft) => {
      const project: Project = {
        id: createId(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        status: draft.status,
        color: draft.color || PROJECT_COLORS[0],
        startDate: draft.startDate || todayISO(),
        targetDate: draft.targetDate,
        ownerId: draft.ownerId || currentMemberIdRef.current,
        createdAt: new Date().toISOString(),
      };
      setProjects(await storage.saveProject(project));
      await log('created project', 'project', project.id, project.name);
    },
    [log],
  );

  const updateProject = useCallback(
    async (project: Project) => {
      setProjects(await storage.saveProject(project));
      await log('updated project', 'project', project.id, project.name);
    },
    [log],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const project = projects.find(item => item.id === id);
      const remainingProjects = await storage.removeProject(id);
      const doomedTaskIds = tasks.filter(task => task.projectId === id).map(task => task.id);
      const remainingTasks = tasks.filter(task => task.projectId !== id);
      const remainingSubtasks = subtasks.filter(subtask => !doomedTaskIds.includes(subtask.taskId));
      const remainingComments = comments.filter(comment => !doomedTaskIds.includes(comment.taskId));
      await Promise.all([
        storage.saveAllTasks(remainingTasks),
        storage.saveAllSubtasks(remainingSubtasks),
        storage.saveAllComments(remainingComments),
      ]);
      setProjects(remainingProjects);
      setTasks(remainingTasks);
      setSubtasks(remainingSubtasks);
      setComments(remainingComments);
      await log('deleted project', 'project', id, project ? project.name : 'a project');
    },
    [projects, tasks, subtasks, comments, log],
  );

  const createTask = useCallback(
    async (draft: TaskDraft) => {
      const now = new Date().toISOString();
      const task: Task = {
        id: createId(),
        projectId: draft.projectId,
        title: draft.title.trim(),
        description: draft.description.trim(),
        type: draft.type,
        status: draft.status,
        priority: draft.priority,
        assigneeId: draft.assigneeId,
        dueDate: draft.dueDate,
        labels: draft.labels,
        order: nextOrder(tasks, draft.status),
        createdAt: now,
        updatedAt: now,
      };
      setTasks(await storage.saveTask(task));
      await log('created task', 'task', task.id, task.title);
    },
    [tasks, log],
  );

  const updateTask = useCallback(
    async (task: Task, action = 'updated task') => {
      const stamped: Task = { ...task, updatedAt: new Date().toISOString() };
      setTasks(await storage.saveTask(stamped));
      await log(action, 'task', stamped.id, stamped.title);
    },
    [log],
  );

  const moveTask = useCallback(
    async (id: string, status: TaskStatus) => {
      const task = tasks.find(item => item.id === id);
      if (!task || task.status === status) return;
      const moved: Task = {
        ...task,
        status,
        order: nextOrder(tasks, status),
        updatedAt: new Date().toISOString(),
      };
      setTasks(await storage.saveTask(moved));
      await log(`moved task to ${status}`, 'task', moved.id, moved.title);
    },
    [tasks, log],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const task = tasks.find(item => item.id === id);
      const remainingTasks = await storage.removeTask(id);
      const remainingSubtasks = subtasks.filter(subtask => subtask.taskId !== id);
      const remainingComments = comments.filter(comment => comment.taskId !== id);
      await Promise.all([
        storage.saveAllSubtasks(remainingSubtasks),
        storage.saveAllComments(remainingComments),
      ]);
      setTasks(remainingTasks);
      setSubtasks(remainingSubtasks);
      setComments(remainingComments);
      await log('deleted task', 'task', id, task ? task.title : 'a task');
    },
    [tasks, subtasks, comments, log],
  );

  const addSubtask = useCallback(async (taskId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const subtask: Subtask = {
      id: createId(),
      taskId,
      title: trimmed,
      done: false,
      createdAt: new Date().toISOString(),
    };
    setSubtasks(await storage.saveSubtask(subtask));
  }, []);

  const toggleSubtask = useCallback(
    async (id: string) => {
      const subtask = subtasks.find(item => item.id === id);
      if (!subtask) return;
      setSubtasks(await storage.saveSubtask({ ...subtask, done: !subtask.done }));
    },
    [subtasks],
  );

  const deleteSubtask = useCallback(async (id: string) => {
    setSubtasks(await storage.removeSubtask(id));
  }, []);

  const addComment = useCallback(
    async (taskId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const comment: Comment = {
        id: createId(),
        taskId,
        authorId: currentMemberIdRef.current,
        body: trimmed,
        createdAt: new Date().toISOString(),
      };
      setComments(await storage.saveComment(comment));
      const task = tasks.find(item => item.id === taskId);
      await log('commented on', 'task', taskId, task ? task.title : 'a task');
    },
    [tasks, log],
  );

  const deleteComment = useCallback(async (id: string) => {
    setComments(await storage.removeComment(id));
  }, []);

  const createMember = useCallback(
    async (draft: MemberDraft) => {
      const trimmed = draft.name.trim();
      if (!trimmed) return;
      const member: Member = {
        id: createId(),
        name: trimmed,
        email: draft.email.trim(),
        role: draft.role,
        initials: initialsFor(trimmed),
        color: draft.color || MEMBER_COLORS[members.length % MEMBER_COLORS.length],
        active: draft.active,
        createdAt: new Date().toISOString(),
      };
      setMembers(await storage.saveMember(member));
      await log('added team member', 'member', member.id, member.name);
    },
    [members, log],
  );

  const updateMember = useCallback(
    async (member: Member) => {
      const cleaned: Member = {
        ...member,
        name: member.name.trim(),
        email: member.email.trim(),
        initials: initialsFor(member.name),
      };
      setMembers(await storage.saveMember(cleaned));
      await log('updated team member', 'member', cleaned.id, cleaned.name);
    },
    [log],
  );

  const setMemberActive = useCallback(
    async (id: string, active: boolean) => {
      const member = members.find(item => item.id === id);
      if (!member || member.active === active) return;
      const next: Member = { ...member, active };
      const saved = await storage.saveMember(next);
      setMembers(saved);
      // Never keep acting as someone who was just deactivated.
      if (!active && currentMemberIdRef.current === id) {
        const replacement = saved.find(item => item.active);
        if (replacement) {
          currentMemberIdRef.current = replacement.id;
          setCurrentMemberId(replacement.id);
          await storage.setCurrentMemberId(replacement.id);
        }
      }
      await log(active ? 'reactivated team member' : 'deactivated team member', 'member', next.id, next.name);
    },
    [members, log],
  );

  const deleteMember = useCallback(
    async (id: string) => {
      const member = members.find(item => item.id === id);
      const remaining = await storage.removeMember(id);
      const unassigned = tasks.map(task => (task.assigneeId === id ? { ...task, assigneeId: '' } : task));
      const reowned = projects.map(project => (project.ownerId === id ? { ...project, ownerId: '' } : project));
      await Promise.all([storage.saveAllTasks(unassigned), storage.saveAllProjects(reowned)]);
      setMembers(remaining);
      setTasks(unassigned);
      setProjects(reowned);
      if (currentMemberIdRef.current === id) {
        const replacement = remaining.find(item => item.active) ?? remaining[0] ?? null;
        const nextId = replacement ? replacement.id : '';
        currentMemberIdRef.current = nextId;
        setCurrentMemberId(nextId);
        await storage.setCurrentMemberId(nextId);
      }
      await log('removed team member', 'member', id, member ? member.name : 'a teammate');
    },
    [members, projects, tasks, log],
  );

  const setCurrentMember = useCallback(async (id: string) => {
    currentMemberIdRef.current = id;
    setCurrentMemberId(id);
    await storage.setCurrentMemberId(id);
  }, []);

  const value = useMemo<WorkspaceValue>(
    () => ({
      ready,
      cloudEnabled: cloud.cloudEnabled,
      refreshing,
      projects,
      tasks,
      subtasks,
      comments,
      members,
      activities,
      currentMemberId,
      createProject,
      updateProject,
      deleteProject,
      createTask,
      updateTask,
      moveTask,
      deleteTask,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      addComment,
      deleteComment,
      createMember,
      updateMember,
      setMemberActive,
      deleteMember,
      setCurrentMember,
      refresh,
    }),
    [
      ready,
      refreshing,
      projects,
      tasks,
      subtasks,
      comments,
      members,
      activities,
      currentMemberId,
      createProject,
      updateProject,
      deleteProject,
      createTask,
      updateTask,
      moveTask,
      deleteTask,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      addComment,
      deleteComment,
      createMember,
      updateMember,
      setMemberActive,
      deleteMember,
      setCurrentMember,
      refresh,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside a WorkspaceProvider');
  return context;
}

/* ------------------------------------------------------------- derived helpers */

export interface ProjectProgress {
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  percent: number;
}

export function progressForProject(
  tasks: Task[],
  projectId: string,
  overdueCheck: (due: string) => boolean,
): ProjectProgress {
  const scoped = tasks.filter(task => task.projectId === projectId);
  const done = scoped.filter(task => task.status === 'Done').length;
  const inProgress = scoped.filter(task => task.status === 'In Progress').length;
  const overdue = scoped.filter(task => task.status !== 'Done' && overdueCheck(task.dueDate)).length;
  return {
    total: scoped.length,
    done,
    inProgress,
    overdue,
    percent: scoped.length === 0 ? 0 : Math.round((done / scoped.length) * 100),
  };
}

export function memberById(members: Member[], id: string): Member | null {
  return members.find(member => member.id === id) ?? null;
}

/**
 * Members offered in an assignee picker: everyone still active, plus whoever is
 * already assigned (so an existing assignment is never silently dropped).
 */
export function assignableMembers(members: Member[], keepId = ''): Member[] {
  return members.filter(member => member.active || member.id === keepId);
}

export interface MemberWorkload {
  assigned: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export function workloadFor(
  tasks: Task[],
  memberId: string,
  overdueCheck: (due: string) => boolean,
): MemberWorkload {
  const mine = tasks.filter(task => task.assigneeId === memberId);
  return {
    assigned: mine.filter(task => task.status !== 'Done').length,
    inProgress: mine.filter(task => task.status === 'In Progress').length,
    completed: mine.filter(task => task.status === 'Done').length,
    overdue: mine.filter(task => task.status !== 'Done' && overdueCheck(task.dueDate)).length,
  };
}
