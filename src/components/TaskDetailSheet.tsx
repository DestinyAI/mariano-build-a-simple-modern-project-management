import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { dueLabel, isOverdue, relativeTime } from '../dates';
import { TaskDraft, assignableMembers, memberById, useWorkspace } from '../store';
import { TASK_PRIORITY_TONE, TASK_STATUS_TONE, TASK_TYPE_TONE, colors, radius, spacing } from '../theme';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '../types';
import { DateField } from './DateField';
import {
  Avatar,
  Badge,
  Button,
  ChipGroup,
  ConfirmDialog,
  Field,
  ProgressBar,
  SheetModal,
  TextField,
  Touchable,
} from './ui';

interface Props {
  visible: boolean;
  taskId: string | null;
  initialStatus: TaskStatus;
  initialProjectId: string;
  onClose: () => void;
}

function draftFromTask(task: Task): TaskDraft {
  return {
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    type: task.type,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate,
    labels: task.labels,
  };
}

export function TaskDetailSheet({
  visible,
  taskId,
  initialStatus,
  initialProjectId,
  onClose,
}: Props): React.ReactElement {
  const {
    projects,
    members,
    tasks,
    subtasks,
    comments,
    createTask,
    updateTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addComment,
    deleteComment,
  } = useWorkspace();

  const task = useMemo(() => (taskId ? tasks.find(item => item.id === taskId) ?? null : null), [tasks, taskId]);
  const isEdit = task !== null;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const [draft, setDraft] = useState<TaskDraft>({
    projectId: initialProjectId,
    title: '',
    description: '',
    type: 'Task',
    status: initialStatus,
    priority: 'Medium',
    assigneeId: '',
    dueDate: '',
    labels: [],
  });
  const [labelInput, setLabelInput] = useState('');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [showTitleError, setShowTitleError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLabelInput('');
    setSubtaskInput('');
    setCommentInput('');
    setShowTitleError(false);
    setConfirmDelete(false);
    const target = taskId ? tasksRef.current.find(item => item.id === taskId) ?? null : null;
    if (target) {
      setDraft(draftFromTask(target));
    } else {
      setDraft({
        projectId: initialProjectId,
        title: '',
        description: '',
        type: 'Task',
        status: initialStatus,
        priority: 'Medium',
        assigneeId: '',
        dueDate: '',
        labels: [],
      });
    }
    // Re-seed only when the sheet opens or points at a different task — never mid-edit.
  }, [visible, taskId, initialStatus, initialProjectId]);

  const taskSubtasks = useMemo(
    () => (task ? subtasks.filter(item => item.taskId === task.id) : []),
    [subtasks, task],
  );
  const taskComments = useMemo(
    () =>
      task
        ? comments.filter(item => item.taskId === task.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        : [],
    [comments, task],
  );

  const doneSubtasks = taskSubtasks.filter(item => item.done).length;
  const subtaskPercent = taskSubtasks.length === 0 ? 0 : (doneSubtasks / taskSubtasks.length) * 100;
  const project = projects.find(item => item.id === draft.projectId) ?? null;

  const submit = (): void => {
    if (draft.title.trim().length === 0) {
      setShowTitleError(true);
      return;
    }
    if (task) {
      void updateTask({
        ...task,
        projectId: draft.projectId,
        title: draft.title.trim(),
        description: draft.description.trim(),
        type: draft.type,
        status: draft.status,
        priority: draft.priority,
        assigneeId: draft.assigneeId,
        dueDate: draft.dueDate,
        labels: draft.labels,
      });
    } else {
      void createTask(draft);
    }
    onClose();
  };

  const addLabel = (): void => {
    const value = labelInput.trim();
    if (!value || draft.labels.includes(value)) {
      setLabelInput('');
      return;
    }
    setDraft({ ...draft, labels: [...draft.labels, value] });
    setLabelInput('');
  };

  const submitSubtask = (): void => {
    if (!task || subtaskInput.trim().length === 0) return;
    void addSubtask(task.id, subtaskInput);
    setSubtaskInput('');
  };

  const submitComment = (): void => {
    if (!task || commentInput.trim().length === 0) return;
    void addComment(task.id, commentInput);
    setCommentInput('');
  };

  return (
    <>
      <SheetModal
        visible={visible}
        wide
        title={isEdit ? 'Task details' : 'New task'}
        subtitle={
          isEdit && task
            ? `${project ? project.name : 'No project'} · updated ${relativeTime(task.updatedAt)}`
            : 'Describe the work, set a priority and drop it on the board.'
        }
        onClose={onClose}
        footer={
          <>
            {isEdit ? (
              <Button
                label="Delete task"
                variant="danger"
                onPress={() => setConfirmDelete(true)}
                style={styles.footerLeft}
              />
            ) : null}
            <Button label="Cancel" variant="outline" onPress={onClose} />
            <Button label={isEdit ? 'Save changes' : 'Create task'} onPress={submit} />
          </>
        }
      >
        <Field label="Title">
          <TextField
            value={draft.title}
            onChangeText={value => setDraft({ ...draft, title: value })}
            placeholder="Ship the new onboarding flow"
            invalid={showTitleError && draft.title.trim().length === 0}
          />
          {showTitleError && draft.title.trim().length === 0 ? (
            <Text style={styles.error}>A task needs a title.</Text>
          ) : null}
        </Field>

        <Field label="Description">
          <TextField
            value={draft.description}
            onChangeText={value => setDraft({ ...draft, description: value })}
            placeholder="Context, acceptance criteria, links…"
            multiline
          />
        </Field>

        <View style={styles.grid}>
          <Field label="Type" style={styles.gridItem}>
            <ChipGroup
              options={TASK_TYPES.map(type => ({ value: type, label: type, tone: TASK_TYPE_TONE[type] }))}
              value={draft.type}
              onChange={(type: TaskType) => setDraft({ ...draft, type })}
            />
          </Field>
          <Field label="Priority" style={styles.gridItem}>
            <ChipGroup
              options={TASK_PRIORITIES.map(priority => ({
                value: priority,
                label: priority,
                tone: TASK_PRIORITY_TONE[priority],
              }))}
              value={draft.priority}
              onChange={(priority: TaskPriority) => setDraft({ ...draft, priority })}
            />
          </Field>
        </View>

        <Field label="Status">
          <ChipGroup
            options={TASK_STATUSES.map(status => ({ value: status, label: status, tone: TASK_STATUS_TONE[status] }))}
            value={draft.status}
            onChange={(status: TaskStatus) => setDraft({ ...draft, status })}
          />
        </Field>

        <Field
          label="Project"
          hint={projects.length === 0 ? 'Create a project first so this task counts towards progress.' : undefined}
        >
          {projects.length === 0 ? (
            <Text style={styles.muted}>No projects yet.</Text>
          ) : (
            <ChipGroup
              options={projects.map(item => ({ value: item.id, label: item.name }))}
              value={draft.projectId}
              onChange={value => setDraft({ ...draft, projectId: value })}
            />
          )}
        </Field>

        <Field label="Assignee">
          <ChipGroup
            options={[
              { value: '', label: 'Unassigned' },
              ...assignableMembers(members, draft.assigneeId).map(member => ({
                value: member.id,
                label: member.active ? member.name : `${member.name} (inactive)`,
              })),
            ]}
            value={draft.assigneeId}
            onChange={value => setDraft({ ...draft, assigneeId: value })}
          />
        </Field>

        <Field
          label="Due date"
          hint={draft.dueDate.length > 0 ? dueLabel(draft.dueDate) : 'Optional — used for overdue highlighting.'}
        >
          <DateField value={draft.dueDate} onChange={value => setDraft({ ...draft, dueDate: value })} />
        </Field>

        <Field label="Labels">
          {draft.labels.length > 0 ? (
            <View style={styles.labelRow}>
              {draft.labels.map(label => (
                <Touchable
                  key={label}
                  accessibilityLabel={`Remove label ${label}`}
                  onPress={() => setDraft({ ...draft, labels: draft.labels.filter(item => item !== label) })}
                  style={styles.labelChip}
                  hoverStyle={styles.labelChipHover}
                >
                  <Text style={styles.labelChipText}>{label}</Text>
                  <Text style={styles.labelChipRemove}>✕</Text>
                </Touchable>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>No labels yet — try “design”, “api” or “needs-review”.</Text>
          )}
          <View style={styles.inlineAddRow}>
            <TextField
              value={labelInput}
              onChangeText={setLabelInput}
              placeholder="Add a label…"
              onSubmitEditing={addLabel}
              style={styles.grow}
            />
            <Button label="Add" small onPress={addLabel} disabled={labelInput.trim().length === 0} />
          </View>
        </Field>

        <View style={styles.divider} />

        <Field
          label={taskSubtasks.length > 0 ? `Subtasks (${doneSubtasks}/${taskSubtasks.length})` : 'Subtasks'}
          hint={isEdit ? undefined : 'Create the task first, then add its checklist here.'}
        >
          {taskSubtasks.length > 0 ? (
            <View style={styles.subtaskBlock}>
              <ProgressBar percent={subtaskPercent} color={colors.accent} height={6} />
              <View style={styles.subtaskList}>
                {taskSubtasks.map(subtask => (
                  <View key={subtask.id} style={styles.subtaskRow}>
                    <Touchable
                      accessibilityLabel={`Toggle ${subtask.title}`}
                      onPress={() => void toggleSubtask(subtask.id)}
                      style={[styles.checkbox, subtask.done ? styles.checkboxDone : null]}
                      hoverStyle={styles.checkboxHover}
                    >
                      {subtask.done ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </Touchable>
                    <Text style={[styles.subtaskTitle, subtask.done ? styles.subtaskTitleDone : null]}>
                      {subtask.title}
                    </Text>
                    <Touchable
                      accessibilityLabel={`Delete subtask ${subtask.title}`}
                      onPress={() => void deleteSubtask(subtask.id)}
                      style={styles.rowRemove}
                      hoverStyle={styles.rowRemoveHover}
                    >
                      <Text style={styles.rowRemoveText}>✕</Text>
                    </Touchable>
                  </View>
                ))}
              </View>
            </View>
          ) : isEdit ? (
            <Text style={styles.muted}>No subtasks yet — break the work into smaller checkable steps.</Text>
          ) : null}
          {isEdit ? (
            <View style={styles.inlineAddRow}>
              <TextField
                value={subtaskInput}
                onChangeText={setSubtaskInput}
                placeholder="Add a subtask…"
                onSubmitEditing={submitSubtask}
                style={styles.grow}
              />
              <Button label="Add" small onPress={submitSubtask} disabled={subtaskInput.trim().length === 0} />
            </View>
          ) : null}
        </Field>

        <Field
          label={taskComments.length > 0 ? `Comments (${taskComments.length})` : 'Comments'}
          hint={isEdit ? undefined : 'Create the task first, then start the discussion.'}
        >
          {taskComments.length > 0 ? (
            <View style={styles.commentList}>
              {taskComments.map(comment => {
                const author = memberById(members, comment.authorId);
                return (
                  <View key={comment.id} style={styles.commentRow}>
                    <Avatar member={author} size={28} />
                    <View style={styles.commentBubble}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>{author ? author.name : 'Someone'}</Text>
                        <Text style={styles.commentTime}>{relativeTime(comment.createdAt)}</Text>
                        <Touchable
                          accessibilityLabel="Delete comment"
                          onPress={() => void deleteComment(comment.id)}
                          style={styles.rowRemove}
                          hoverStyle={styles.rowRemoveHover}
                        >
                          <Text style={styles.rowRemoveText}>✕</Text>
                        </Touchable>
                      </View>
                      <Text style={styles.commentBody}>{comment.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : isEdit ? (
            <Text style={styles.muted}>No comments yet — leave the first note for the team.</Text>
          ) : null}
          {isEdit ? (
            <View style={styles.inlineAddRow}>
              <TextField
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder="Write a comment…"
                onSubmitEditing={submitComment}
                style={styles.grow}
              />
              <Button
                label="Comment"
                small
                variant="accent"
                onPress={submitComment}
                disabled={commentInput.trim().length === 0}
              />
            </View>
          ) : null}
        </Field>

        {isEdit && task ? (
          <View style={styles.metaFooter}>
            <Badge label={task.type} tone={TASK_TYPE_TONE[task.type]} />
            <Badge label={task.priority} tone={TASK_PRIORITY_TONE[task.priority]} />
            <Badge label={task.status} tone={TASK_STATUS_TONE[task.status]} />
            {task.dueDate ? (
              <Text style={[styles.metaText, isOverdue(task.dueDate) ? styles.metaLate : null]}>
                {dueLabel(task.dueDate)}
              </Text>
            ) : (
              <Text style={styles.metaText}>No due date</Text>
            )}
            <Text style={styles.metaText}>Created {relativeTime(task.createdAt)}</Text>
          </View>
        ) : null}
      </SheetModal>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete task?"
        message={
          task
            ? `"${task.title}" plus its ${taskSubtasks.length} subtask(s) and ${taskComments.length} comment(s) will be removed.`
            : ''
        }
        confirmLabel="Delete task"
        onConfirm={() => {
          if (task) void deleteTask(task.id);
          setConfirmDelete(false);
          onClose();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  footerLeft: { marginRight: 'auto' },
  error: { fontSize: 12, color: colors.danger, marginTop: 5, fontWeight: '600' },
  muted: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  gridItem: { flexGrow: 1, flexBasis: 240 },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  labelChipHover: { backgroundColor: colors.accentBorder },
  labelChipText: { fontSize: 11.5, fontWeight: '700', color: colors.accent },
  labelChipRemove: { fontSize: 10, color: colors.accent, fontWeight: '800' },
  inlineAddRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  grow: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.lg },
  subtaskBlock: { gap: spacing.sm },
  subtaskList: { gap: 6 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxHover: { borderColor: colors.primary },
  checkboxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.white, fontSize: 12, fontWeight: '800' },
  subtaskTitle: { flex: 1, fontSize: 13.5, color: colors.text },
  subtaskTitleDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  rowRemove: { width: 22, height: 22, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowRemoveHover: { backgroundColor: colors.dangerSoft },
  rowRemoveText: { fontSize: 11, color: colors.textFaint, fontWeight: '700' },
  commentList: { gap: spacing.md, marginBottom: spacing.sm },
  commentRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  commentAuthor: { fontSize: 12.5, fontWeight: '800', color: colors.text },
  commentTime: { fontSize: 11, color: colors.textFaint, flex: 1 },
  commentBody: { fontSize: 13, color: colors.text, lineHeight: 19 },
  metaFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  metaText: { fontSize: 11.5, color: colors.textFaint, fontWeight: '600' },
  metaLate: { color: colors.danger },
});
