import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateField } from '../../src/components/DateField';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChipGroup,
  ConfirmDialog,
  EmptyState,
  Field,
  PageHeader,
  ProgressBar,
  SheetModal,
  TextField,
  Touchable,
} from '../../src/components/ui';
import { formatDate, isOverdue, isValidISODate, todayISO } from '../../src/dates';
import { ProjectDraft, memberById, progressForProject, useWorkspace } from '../../src/store';
import { PROJECT_COLORS, PROJECT_STATUS_TONE, colors, radius, shadow, spacing } from '../../src/theme';
import { PROJECT_STATUSES, Project, ProjectStatus } from '../../src/types';

type StatusFilter = 'All' | ProjectStatus;

const STATUS_FILTERS: StatusFilter[] = ['All', ...PROJECT_STATUSES];

const STATUS_WEIGHT: Record<ProjectStatus, number> = {
  Active: 0,
  Planning: 1,
  'On Hold': 2,
  Completed: 3,
};

function emptyDraft(ownerId: string): ProjectDraft {
  return {
    name: '',
    description: '',
    status: 'Planning',
    color: PROJECT_COLORS[0],
    startDate: todayISO(),
    targetDate: '',
    ownerId,
  };
}

export default function ProjectsScreen(): React.ReactElement {
  const router = useRouter();
  const { projects, tasks, members, currentMemberId, createProject, updateProject, deleteProject } =
    useWorkspace();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(() => emptyDraft(currentMemberId));
  const [showErrors, setShowErrors] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('All');

  const visible = useMemo(() => {
    const list = filter === 'All' ? projects : projects.filter(project => project.status === filter);
    return list.slice().sort((a, b) => {
      const weight = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
      if (weight !== 0) return weight;
      return (a.targetDate || '9999').localeCompare(b.targetDate || '9999');
    });
  }, [projects, filter]);

  const ownerOptions = useMemo(
    () =>
      members
        .filter(member => member.active || member.id === draft.ownerId)
        .map(member => ({ value: member.id, label: member.active ? member.name : `${member.name} (inactive)` })),
    [members, draft.ownerId],
  );

  const openCreate = (): void => {
    setEditing(null);
    setDraft(emptyDraft(currentMemberId));
    setShowErrors(false);
    setSheetOpen(true);
  };

  const openEdit = (project: Project): void => {
    setEditing(project);
    setDraft({
      name: project.name,
      description: project.description,
      status: project.status,
      color: project.color,
      startDate: project.startDate,
      targetDate: project.targetDate,
      ownerId: project.ownerId,
    });
    setShowErrors(false);
    setSheetOpen(true);
  };

  const nameError = draft.name.trim().length === 0;
  const startError = draft.startDate.length > 0 && !isValidISODate(draft.startDate);
  const targetError = draft.targetDate.length > 0 && !isValidISODate(draft.targetDate);
  const orderError =
    !startError &&
    !targetError &&
    draft.startDate.length > 0 &&
    draft.targetDate.length > 0 &&
    draft.targetDate < draft.startDate;
  const hasError = nameError || startError || targetError || orderError;

  const submit = (): void => {
    if (hasError) {
      setShowErrors(true);
      return;
    }
    if (editing) {
      void updateProject({
        ...editing,
        name: draft.name.trim(),
        description: draft.description.trim(),
        status: draft.status,
        color: draft.color,
        startDate: draft.startDate,
        targetDate: draft.targetDate,
        ownerId: draft.ownerId,
      });
    } else {
      void createProject(draft);
    }
    setSheetOpen(false);
    setEditing(null);
  };

  const confirmDelete = (): void => {
    if (pendingDelete) void deleteProject(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <PageHeader
            eyebrow="Workspace"
            title="Projects"
            subtitle={`${projects.length} ${projects.length === 1 ? 'project' : 'projects'} · ${tasks.length} ${
              tasks.length === 1 ? 'task' : 'tasks'
            } tracked across the team`}
            right={<Button label="+ New project" onPress={openCreate} />}
          />

          <ChipGroup
            options={STATUS_FILTERS.map(status => ({
              value: status,
              label:
                status === 'All'
                  ? `All (${projects.length})`
                  : `${status} (${projects.filter(project => project.status === status).length})`,
            }))}
            value={filter}
            onChange={setFilter}
            style={styles.filterRow}
          />

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                emoji="📁"
                title={projects.length === 0 ? 'No projects yet' : `No ${filter.toLowerCase()} projects`}
                message={
                  projects.length === 0
                    ? 'A project groups related tasks, gives you a progress bar and puts a bar on the roadmap. Create your first one to get started.'
                    : 'Nothing matches this filter yet. Switch back to All, or create a project with this status.'
                }
                actionLabel="+ New project"
                onAction={openCreate}
              />
            </Card>
          ) : (
            <View style={styles.list}>
              {visible.map(project => {
                const progress = progressForProject(tasks, project.id, isOverdue);
                const late =
                  project.status !== 'Completed' &&
                  project.targetDate.length > 0 &&
                  isOverdue(project.targetDate);
                return (
                  <Card key={project.id} style={styles.projectCard}>
                    <View style={[styles.colorRail, { backgroundColor: project.color }]} />
                    <View style={styles.cardBody}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderText}>
                          <View style={styles.titleRow}>
                            <Text style={styles.projectName}>{project.name}</Text>
                            <Badge label={project.status} tone={PROJECT_STATUS_TONE[project.status]} />
                            {late ? (
                              <Badge
                                label="Past target"
                                tone={{ fg: '#B91C1C', bg: colors.dangerSoft, border: '#FECACA' }}
                              />
                            ) : null}
                          </View>
                          <Text style={styles.projectDescription}>
                            {project.description || 'No description yet — add one so the team knows the goal.'}
                          </Text>
                        </View>
                        <View style={styles.cardActions}>
                          <Button label="Edit" variant="outline" small onPress={() => openEdit(project)} />
                          <Button label="Delete" variant="danger" small onPress={() => setPendingDelete(project)} />
                        </View>
                      </View>

                      <View style={styles.progressBlock}>
                        <View style={styles.progressRow}>
                          <Text style={styles.progressLabel}>
                            {progress.done} of {progress.total} tasks complete
                          </Text>
                          <Text style={[styles.progressPercent, { color: project.color }]}>
                            {progress.percent}%
                          </Text>
                        </View>
                        <ProgressBar percent={progress.percent} color={project.color} height={10} />
                      </View>

                      <View style={styles.metaRow}>
                        <View style={styles.ownerChip}>
                          <Avatar member={memberById(members, project.ownerId)} size={20} />
                          <Text style={styles.ownerName} numberOfLines={1}>
                            {memberById(members, project.ownerId)?.name ?? 'No owner'}
                          </Text>
                        </View>
                        <Text style={styles.meta}>
                          🚀 Starts {project.startDate ? formatDate(project.startDate) : '—'}
                        </Text>
                        <Text style={late ? styles.metaLate : styles.meta}>
                          🎯 Target {project.targetDate ? formatDate(project.targetDate) : '—'}
                        </Text>
                        <Text style={styles.meta}>⚡ {progress.inProgress} in progress</Text>
                        {progress.overdue > 0 ? (
                          <Text style={styles.metaLate}>⏰ {progress.overdue} overdue</Text>
                        ) : null}
                        <Touchable
                          accessibilityLabel={`Open ${project.name} on the board`}
                          onPress={() => router.push('/board')}
                          style={styles.linkChip}
                          hoverStyle={styles.linkChipHover}
                        >
                          <Text style={styles.linkChipText}>Open on board →</Text>
                        </Touchable>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <SheetModal
        visible={sheetOpen}
        title={editing ? 'Edit project' : 'New project'}
        subtitle={
          editing
            ? 'Update the details, status or dates for this project.'
            : 'Give the project a name, a status and a target date.'
        }
        onClose={() => setSheetOpen(false)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setSheetOpen(false)} />
            <Button label={editing ? 'Save changes' : 'Create project'} onPress={submit} />
          </>
        }
      >
        <Field label="Project name">
          <TextField
            value={draft.name}
            onChangeText={value => setDraft({ ...draft, name: value })}
            placeholder="Mobile app redesign"
            invalid={showErrors && nameError}
          />
          {showErrors && nameError ? <Text style={styles.error}>A project needs a name.</Text> : null}
        </Field>

        <Field label="Description">
          <TextField
            value={draft.description}
            onChangeText={value => setDraft({ ...draft, description: value })}
            placeholder="What is this project trying to achieve?"
            multiline
          />
        </Field>

        <Field label="Status">
          <ChipGroup
            options={PROJECT_STATUSES.map(status => ({
              value: status,
              label: status,
              tone: PROJECT_STATUS_TONE[status],
            }))}
            value={draft.status}
            onChange={status => setDraft({ ...draft, status })}
          />
        </Field>

        <Field
          label="Owner"
          hint={
            ownerOptions.length === 0
              ? 'Add a team member in the Team tab to give this project an owner.'
              : 'The teammate accountable for this project.'
          }
        >
          {ownerOptions.length === 0 ? (
            <Button label="Open the Team tab" variant="outline" small onPress={() => router.push('/team')} />
          ) : (
            <ChipGroup
              options={[{ value: '', label: 'Unassigned' }, ...ownerOptions]}
              value={draft.ownerId}
              onChange={value => setDraft({ ...draft, ownerId: value })}
            />
          )}
        </Field>

        <Field label="Colour" hint="Used for the progress bar and the roadmap timeline.">
          <View style={styles.swatchRow}>
            {PROJECT_COLORS.map(color => (
              <Touchable
                key={color}
                accessibilityLabel={`Use colour ${color}`}
                onPress={() => setDraft({ ...draft, color })}
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  draft.color === color ? styles.swatchSelected : null,
                ]}
                hoverStyle={styles.swatchHover}
              >
                {draft.color === color ? <Text style={styles.swatchCheck}>✓</Text> : null}
              </Touchable>
            ))}
          </View>
        </Field>

        <Field label="Start date">
          <DateField value={draft.startDate} onChange={value => setDraft({ ...draft, startDate: value })} />
        </Field>

        <Field label="Target date">
          <DateField value={draft.targetDate} onChange={value => setDraft({ ...draft, targetDate: value })} />
          {orderError ? (
            <Text style={styles.error}>The target date must be on or after the start date.</Text>
          ) : null}
        </Field>
      </SheetModal>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete project?"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" and its ${
                tasks.filter(task => task.projectId === pendingDelete.id).length
              } task(s), subtasks and comments will be permanently removed.`
            : ''
        }
        confirmLabel="Delete project"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  inner: { width: '100%', maxWidth: 1080, alignSelf: 'center' },
  filterRow: { marginBottom: spacing.lg },
  list: { gap: spacing.lg },
  projectCard: { padding: 0, overflow: 'hidden', flexDirection: 'row' },
  colorRail: { width: 6 },
  cardBody: { flex: 1, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', flexWrap: 'wrap' },
  cardHeaderText: { flex: 1, minWidth: 220 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  projectName: { fontSize: 17, fontWeight: '800', color: colors.text },
  projectDescription: { fontSize: 13, color: colors.textMuted, marginTop: 5, lineHeight: 19 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  progressBlock: { marginTop: spacing.lg },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  progressPercent: { fontSize: 14, fontWeight: '800' },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  meta: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  ownerChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownerName: { fontSize: 12, color: colors.text, fontWeight: '700', maxWidth: 160 },
  metaLate: { fontSize: 12, color: colors.danger, fontWeight: '700' },
  linkChip: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  linkChipHover: { backgroundColor: colors.primaryBorder },
  linkChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  error: { fontSize: 12, color: colors.danger, marginTop: 5, fontWeight: '600' },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow.card,
  },
  swatchHover: { borderColor: colors.borderStrong },
  swatchSelected: { borderColor: colors.text },
  swatchCheck: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
