export type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed';

export type TaskType = 'Feature' | 'Bug' | 'Task' | 'Improvement';

export type TaskStatus = 'Backlog' | 'To Do' | 'In Progress' | 'Review' | 'Done';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type MemberRole = 'Owner' | 'Admin' | 'Member' | 'Viewer';

export type ActivityTargetType = 'project' | 'task' | 'member';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  startDate: string;
  targetDate: string;
  /** Member id of whoever owns the project — '' when nobody is assigned yet. */
  ownerId: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  labels: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  initials: string;
  color: string;
  /** Inactive members keep their history but are hidden from assignee pickers. */
  active: boolean;
  createdAt: string;
}

export interface Activity {
  id: string;
  actorId: string;
  action: string;
  targetType: ActivityTargetType;
  targetId: string;
  targetTitle: string;
  createdAt: string;
}

export const PROJECT_STATUSES: ProjectStatus[] = ['Planning', 'Active', 'On Hold', 'Completed'];
export const TASK_TYPES: TaskType[] = ['Feature', 'Bug', 'Task', 'Improvement'];
export const TASK_STATUSES: TaskStatus[] = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
export const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];
export const MEMBER_ROLES: MemberRole[] = ['Owner', 'Admin', 'Member', 'Viewer'];

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
