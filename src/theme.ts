import { MemberRole, ProjectStatus, TaskPriority, TaskStatus, TaskType } from './types';

export const colors = {
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primarySoft: '#EEF2FF',
  primaryBorder: '#C7D2FE',
  accent: '#8B5CF6',
  accentSoft: '#F5F3FF',
  accentBorder: '#DDD6FE',
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#FAFAFF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  successSoft: '#ECFDF5',
  warningSoft: '#FFFBEB',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  slate: '#64748B',
  slateSoft: '#F1F5F9',
  white: '#FFFFFF',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };

export interface ToneColors {
  fg: string;
  bg: string;
  border: string;
}

export const PROJECT_STATUS_TONE: Record<ProjectStatus, ToneColors> = {
  Planning: { fg: colors.slate, bg: colors.slateSoft, border: '#E2E8F0' },
  Active: { fg: colors.primary, bg: colors.primarySoft, border: colors.primaryBorder },
  'On Hold': { fg: '#B45309', bg: colors.warningSoft, border: '#FDE68A' },
  Completed: { fg: '#047857', bg: colors.successSoft, border: '#A7F3D0' },
};

export const TASK_TYPE_TONE: Record<TaskType, ToneColors> = {
  Feature: { fg: colors.accent, bg: colors.accentSoft, border: colors.accentBorder },
  Bug: { fg: '#B91C1C', bg: colors.dangerSoft, border: '#FECACA' },
  Task: { fg: colors.primary, bg: colors.primarySoft, border: colors.primaryBorder },
  Improvement: { fg: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC' },
};

export const TASK_PRIORITY_TONE: Record<TaskPriority, ToneColors> = {
  Low: { fg: colors.slate, bg: colors.slateSoft, border: '#E2E8F0' },
  Medium: { fg: colors.primary, bg: colors.primarySoft, border: colors.primaryBorder },
  High: { fg: '#B45309', bg: colors.warningSoft, border: '#FDE68A' },
  Critical: { fg: '#B91C1C', bg: colors.dangerSoft, border: '#FECACA' },
};

export const TASK_STATUS_TONE: Record<TaskStatus, ToneColors> = {
  Backlog: { fg: colors.slate, bg: colors.slateSoft, border: '#E2E8F0' },
  'To Do': { fg: colors.primary, bg: colors.primarySoft, border: colors.primaryBorder },
  'In Progress': { fg: colors.accent, bg: colors.accentSoft, border: colors.accentBorder },
  Review: { fg: '#B45309', bg: colors.warningSoft, border: '#FDE68A' },
  Done: { fg: '#047857', bg: colors.successSoft, border: '#A7F3D0' },
};

export const MEMBER_ROLE_TONE: Record<MemberRole, ToneColors> = {
  Owner: { fg: colors.accent, bg: colors.accentSoft, border: colors.accentBorder },
  Admin: { fg: colors.primary, bg: colors.primarySoft, border: colors.primaryBorder },
  Member: { fg: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC' },
  Viewer: { fg: colors.slate, bg: colors.slateSoft, border: '#E2E8F0' },
};

export const MEMBER_ACTIVE_TONE: ToneColors = { fg: '#047857', bg: colors.successSoft, border: '#A7F3D0' };
export const MEMBER_INACTIVE_TONE: ToneColors = { fg: colors.slate, bg: colors.slateSoft, border: '#E2E8F0' };

export const PROJECT_COLORS: string[] = [
  '#4F46E5',
  '#8B5CF6',
  '#6366F1',
  '#A855F7',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
];

export const MEMBER_COLORS: string[] = [
  '#4F46E5',
  '#8B5CF6',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#14B8A6',
  '#F43F5E',
];

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
};
