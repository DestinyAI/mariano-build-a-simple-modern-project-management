import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionTitle,
  Touchable,
} from '../../src/components/ui';
import { SyncNotice } from '../../src/components/SyncStatus';
import { formatDate, isOverdue, relativeTime } from '../../src/dates';
import { memberById, progressForProject, useWorkspace, workloadFor } from '../../src/store';
import { PROJECT_STATUS_TONE, colors, radius, shadow, spacing } from '../../src/theme';
import { ActivityTargetType, Project } from '../../src/types';

const ACTIVITY_EMOJI: Record<ActivityTargetType, string> = {
  project: '📁',
  task: '🗒️',
  member: '👥',
};

interface StatTileData {
  key: string;
  label: string;
  value: number;
  caption: string;
  emoji: string;
  fg: string;
  bg: string;
  border: string;
}

export default function DashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { ready, projects, tasks, members, activities, currentMemberId } = useWorkspace();

  const twoColumn = width >= 1180;

  const stats = useMemo<StatTileData[]>(() => {
    const open = tasks.filter(task => task.status !== 'Done');
    const inProgress = tasks.filter(task => task.status === 'In Progress');
    const overdue = open.filter(task => isOverdue(task.dueDate));
    const done = tasks.filter(task => task.status === 'Done');
    return [
      {
        key: 'open',
        label: 'Open tasks',
        value: open.length,
        caption: `${tasks.length} total in the workspace`,
        emoji: '🗒️',
        fg: colors.primary,
        bg: colors.primarySoft,
        border: colors.primaryBorder,
      },
      {
        key: 'progress',
        label: 'In progress',
        value: inProgress.length,
        caption: 'Being worked on right now',
        emoji: '⚡',
        fg: colors.accent,
        bg: colors.accentSoft,
        border: colors.accentBorder,
      },
      {
        key: 'overdue',
        label: 'Overdue',
        value: overdue.length,
        caption: overdue.length === 0 ? 'Nothing past its due date' : 'Past due and still open',
        emoji: '⏰',
        fg: '#B91C1C',
        bg: colors.dangerSoft,
        border: '#FECACA',
      },
      {
        key: 'done',
        label: 'Completed',
        value: done.length,
        caption: 'Moved into the Done column',
        emoji: '✅',
        fg: '#047857',
        bg: colors.successSoft,
        border: '#A7F3D0',
      },
    ];
  }, [tasks]);

  const activeProjects = useMemo<Project[]>(
    () =>
      projects
        .filter(project => project.status !== 'Completed')
        .sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999')),
    [projects],
  );

  const recentActivity = useMemo(
    () => activities.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12),
    [activities],
  );

  const activeMembers = useMemo(() => members.filter(member => member.active), [members]);
  const inactiveCount = members.length - activeMembers.length;

  const overallPercent = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter(task => task.status === 'Done').length / tasks.length) * 100);
  }, [tasks]);

  const projectsPanel = (
    <View style={styles.panel}>
      <SectionTitle
        title="Active projects"
        action={
          activeProjects.length > 0 ? (
            <Button label="Manage projects" variant="ghost" small onPress={() => router.push('/projects')} />
          ) : undefined
        }
      />
      {activeProjects.length === 0 ? (
        <Card>
          <EmptyState
            emoji="📁"
            title={projects.length === 0 ? 'No projects yet' : 'Every project is completed'}
            message={
              projects.length === 0
                ? 'Create a project to start tracking work, progress and deadlines for your team.'
                : 'Nice work! Start a new project when the team is ready for the next push.'
            }
            actionLabel="Go to Projects"
            onAction={() => router.push('/projects')}
          />
        </Card>
      ) : (
        <View style={styles.projectGrid}>
          {activeProjects.map(project => {
            const progress = progressForProject(tasks, project.id, isOverdue);
            return (
              <Touchable
                key={project.id}
                accessibilityLabel={`Open ${project.name} on the board`}
                onPress={() => router.push('/board')}
                style={[styles.projectCard, { borderTopColor: project.color }]}
                hoverStyle={styles.projectCardHover}
              >
                <View style={styles.projectTop}>
                  <View style={styles.projectTitleWrap}>
                    <Text style={styles.projectName} numberOfLines={1}>
                      {project.name}
                    </Text>
                    <Text style={styles.projectDescription} numberOfLines={2}>
                      {project.description || 'No description yet.'}
                    </Text>
                  </View>
                  <Badge label={project.status} tone={PROJECT_STATUS_TONE[project.status]} />
                </View>

                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>
                    {progress.done}/{progress.total} tasks done
                  </Text>
                  <Text style={[styles.progressPercent, { color: project.color }]}>{progress.percent}%</Text>
                </View>
                <ProgressBar percent={progress.percent} color={project.color} />

                <View style={styles.projectMetaRow}>
                  <Text style={styles.projectMeta}>
                    🎯 {project.targetDate ? formatDate(project.targetDate) : 'No target date'}
                  </Text>
                  {progress.overdue > 0 ? (
                    <Text style={styles.projectOverdue}>⏰ {progress.overdue} overdue</Text>
                  ) : (
                    <Text style={styles.projectMeta}>⚡ {progress.inProgress} in progress</Text>
                  )}
                </View>
              </Touchable>
            );
          })}
        </View>
      )}
    </View>
  );

  const teamPanel = (
    <Card style={styles.sideCard}>
      <SectionTitle
        title="Team"
        action={<Button label="Manage team" variant="ghost" small onPress={() => router.push('/team')} />}
      />
      {activeMembers.length === 0 ? (
        <EmptyState
          emoji="👥"
          title="No active members"
          message="The users module keeps the team directory in the shared database. Add someone so tasks can be assigned and activity attributed."
          actionLabel="Open the users module"
          onAction={() => router.push('/team')}
        />
      ) : (
        <View style={styles.memberList}>
          {activeMembers.slice(0, 6).map(member => {
            const load = workloadFor(tasks, member.id, isOverdue);
            return (
              <Touchable
                key={member.id}
                accessibilityLabel={`Open ${member.name} in the team directory`}
                onPress={() => router.push('/team')}
                style={styles.memberRow}
                hoverStyle={styles.memberRowHover}
              >
                <Avatar member={member} size={30} />
                <View style={styles.memberTextWrap}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.name}
                    {member.id === currentMemberId ? ' · you' : ''}
                  </Text>
                  <Text style={styles.memberMeta} numberOfLines={1}>
                    {member.role}
                    {member.email.length > 0 ? ` · ${member.email}` : ''}
                  </Text>
                </View>
                <Text style={load.overdue > 0 ? styles.memberCountLate : styles.memberCount}>
                  {load.assigned} open
                </Text>
              </Touchable>
            );
          })}
          {activeMembers.length > 6 ? (
            <Text style={styles.memberMore}>+{activeMembers.length - 6} more in the users module</Text>
          ) : null}
        </View>
      )}
      {inactiveCount > 0 ? (
        <Text style={styles.memberMore}>
          {inactiveCount} inactive {inactiveCount === 1 ? 'member' : 'members'} hidden
        </Text>
      ) : null}
    </Card>
  );

  const activityPanel = (
    <Card style={styles.sideCard}>
      <SectionTitle title="Recent activity" />
      {recentActivity.length === 0 ? (
        <EmptyState
          emoji="📡"
          title="No activity yet"
          message="Create a project or a task and the team's latest changes will show up here."
          actionLabel="Create a project"
          onAction={() => router.push('/projects')}
        />
      ) : (
        <View style={styles.activityList}>
          {recentActivity.map(activity => {
            const actor = memberById(members, activity.actorId);
            return (
              <View key={activity.id} style={styles.activityRow}>
                <Avatar member={actor} size={28} />
                <View style={styles.activityTextWrap}>
                  <Text style={styles.activityText}>
                    <Text style={styles.activityActor}>{actor ? actor.name : 'Someone'}</Text>
                    {` ${activity.action} `}
                    <Text style={styles.activityTarget}>{activity.targetTitle}</Text>
                  </Text>
                  <Text style={styles.activityTime}>
                    {ACTIVITY_EMOJI[activity.targetType]} {relativeTime(activity.createdAt)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <PageHeader
            eyebrow="Overview"
            title="Dashboard"
            subtitle={
              ready
                ? `${projects.length} ${
                    projects.length === 1 ? 'project' : 'projects'
                  } · ${overallPercent}% of all tasks completed`
                : 'Loading your workspace…'
            }
            right={
              <>
                <Button label="Open board" variant="outline" onPress={() => router.push('/board')} />
                <Button label="+ New project" onPress={() => router.push('/projects')} />
              </>
            }
          />

          <View style={styles.syncNotice}>
            <SyncNotice />
          </View>

          <View style={styles.statRow}>
            {stats.map(stat => (
              <View key={stat.key} style={[styles.statTile, { borderColor: stat.border }]}>
                <View style={[styles.statIcon, { backgroundColor: stat.bg }]}>
                  <Text style={styles.statEmoji}>{stat.emoji}</Text>
                </View>
                <Text style={[styles.statValue, { color: stat.fg }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statCaption} numberOfLines={2}>
                  {stat.caption}
                </Text>
              </View>
            ))}
          </View>

          {twoColumn ? (
            <View style={styles.columns}>
              <View style={styles.mainColumn}>{projectsPanel}</View>
              <View style={styles.sideColumn}>
                {teamPanel}
                {activityPanel}
              </View>
            </View>
          ) : (
            <View style={styles.stack}>
              {projectsPanel}
              {teamPanel}
              {activityPanel}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  inner: { width: '100%', maxWidth: 1280, alignSelf: 'center' },
  syncNotice: { marginBottom: spacing.lg },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  statTile: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadow.card,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statEmoji: { fontSize: 17 },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  statLabel: { fontSize: 13.5, fontWeight: '700', color: colors.text, marginTop: 2 },
  statCaption: { fontSize: 11.5, color: colors.textFaint, marginTop: 3, lineHeight: 16 },
  columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  mainColumn: { flex: 1.6 },
  sideColumn: { flex: 1, minWidth: 320, gap: spacing.lg },
  stack: { gap: spacing.xl },
  panel: { width: '100%' },
  projectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  projectCard: {
    flexGrow: 1,
    flexBasis: 300,
    minWidth: 260,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    padding: spacing.lg,
    ...shadow.card,
  },
  projectCardHover: { borderColor: colors.primaryBorder, backgroundColor: colors.surfaceAlt },
  projectTop: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  projectTitleWrap: { flex: 1 },
  projectName: { fontSize: 15.5, fontWeight: '800', color: colors.text },
  projectDescription: { fontSize: 12.5, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  progressPercent: { fontSize: 13, fontWeight: '800' },
  projectMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  projectMeta: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600' },
  projectOverdue: { fontSize: 11.5, color: colors.danger, fontWeight: '700' },
  sideCard: { width: '100%' },
  memberList: { gap: spacing.xs },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  memberRowHover: { backgroundColor: colors.surfaceAlt },
  memberTextWrap: { flex: 1 },
  memberName: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  memberMeta: { fontSize: 11, color: colors.textFaint, marginTop: 1 },
  memberCount: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600' },
  memberCountLate: { fontSize: 11.5, color: colors.danger, fontWeight: '700' },
  memberMore: { fontSize: 11.5, color: colors.textFaint, fontWeight: '600', marginTop: spacing.sm },
  activityList: { gap: spacing.md },
  activityRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  activityTextWrap: { flex: 1 },
  activityText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  activityActor: { fontWeight: '800', color: colors.text },
  activityTarget: { fontWeight: '700', color: colors.primary },
  activityTime: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
});
