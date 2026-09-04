import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskDetailSheet } from '../../src/components/TaskDetailSheet';
import { Avatar, Badge, Button, Card, ChipGroup, EmptyState, PageHeader, Touchable } from '../../src/components/ui';
import { formatShortDate, isOverdue } from '../../src/dates';
import { memberById, useWorkspace } from '../../src/store';
import {
  TASK_PRIORITY_TONE,
  TASK_STATUS_TONE,
  TASK_TYPE_TONE,
  colors,
  radius,
  shadow,
  spacing,
} from '../../src/theme';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  Member,
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '../../src/types';

const SIDEBAR_BREAKPOINT = 900;
const SIDEBAR_WIDTH = 236;
const MIN_COLUMN_WIDTH = 286;
const COLUMN_GAP = 14;
const PREVIEW_WIDTH = 250;
const DRAG_THRESHOLD = 6;

interface ColumnRange {
  status: TaskStatus;
  start: number;
  end: number;
}

type AssigneeFilter = 'all' | 'unassigned' | string;
type PriorityFilter = 'All' | TaskPriority;
type TypeFilter = 'All' | TaskType;
type ProjectFilter = 'all' | string;

interface CardCallbacks {
  onDragStart: (task: Task, pageX: number, pageY: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (pageX: number) => void;
  onDragCancel: () => void;
}

interface BoardCardProps extends CardCallbacks {
  task: Task;
  dimmed: boolean;
  assignee: Member | null;
  subtaskDone: number;
  subtaskTotal: number;
  commentCount: number;
  projectColor: string;
  projectName: string;
  onOpen: (task: Task) => void;
  onShift: (task: Task, delta: number) => void;
}

function BoardCard({
  task,
  dimmed,
  assignee,
  subtaskDone,
  subtaskTotal,
  commentCount,
  projectColor,
  projectName,
  onOpen,
  onShift,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: BoardCardProps): React.ReactElement {
  const taskRef = useRef(task);
  taskRef.current = task;

  // Only claims the gesture once the pointer has actually moved, so a plain click still opens the task.
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD,
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_event, gesture) => onDragStart(taskRef.current, gesture.x0, gesture.y0),
        onPanResponderMove: (_event, gesture) => onDragMove(gesture.moveX, gesture.moveY),
        onPanResponderRelease: (_event, gesture) => onDragEnd(gesture.moveX),
        onPanResponderTerminate: () => onDragCancel(),
      }),
    [onDragStart, onDragMove, onDragEnd, onDragCancel],
  );

  const overdue = task.status !== 'Done' && isOverdue(task.dueDate);
  const statusIndex = TASK_STATUSES.indexOf(task.status);

  return (
    <View {...responder.panHandlers} style={dimmed ? styles.cardWrapDragging : styles.cardWrap}>
      <Touchable
        accessibilityLabel={`Open task ${task.title}`}
        onPress={() => onOpen(task)}
        style={[styles.taskCard, { borderLeftColor: projectColor }]}
        hoverStyle={styles.taskCardHover}
      >
        <View style={styles.cardTopRow}>
          <Badge label={task.type} tone={TASK_TYPE_TONE[task.type]} />
          <Badge label={task.priority} tone={TASK_PRIORITY_TONE[task.priority]} />
          <View style={styles.flexSpacer} />
          <Text style={styles.dragHandle}>⠿</Text>
        </View>

        <Text style={styles.taskTitle} numberOfLines={3}>
          {task.title}
        </Text>

        <Text style={styles.taskProject} numberOfLines={1}>
          📁 {projectName}
        </Text>

        {task.labels.length > 0 ? (
          <View style={styles.labelRow}>
            {task.labels.slice(0, 3).map(label => (
              <View key={label} style={styles.labelPill}>
                <Text style={styles.labelPillText}>{label}</Text>
              </View>
            ))}
            {task.labels.length > 3 ? <Text style={styles.labelMore}>+{task.labels.length - 3}</Text> : null}
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Avatar member={assignee} size={24} />
          {subtaskTotal > 0 ? (
            <Text style={styles.footerMeta}>
              ☑ {subtaskDone}/{subtaskTotal}
            </Text>
          ) : null}
          {commentCount > 0 ? <Text style={styles.footerMeta}>💬 {commentCount}</Text> : null}
          <View style={styles.flexSpacer} />
          {task.dueDate ? (
            <View style={overdue ? styles.duePillLate : styles.duePill}>
              <Text style={overdue ? styles.dueTextLate : styles.dueText}>
                {overdue ? '⏰ ' : '📅 '}
                {formatShortDate(task.dueDate)}
              </Text>
            </View>
          ) : null}
        </View>
      </Touchable>

      <View style={styles.shiftRow}>
        <Touchable
          accessibilityLabel="Move task to the previous column"
          disabled={statusIndex === 0}
          onPress={() => onShift(task, -1)}
          style={styles.shiftButton}
          hoverStyle={styles.shiftButtonHover}
        >
          <Text style={styles.shiftText}>◀</Text>
        </Touchable>
        <Touchable
          accessibilityLabel="Move task to the next column"
          disabled={statusIndex === TASK_STATUSES.length - 1}
          onPress={() => onShift(task, 1)}
          style={styles.shiftButton}
          hoverStyle={styles.shiftButtonHover}
        >
          <Text style={styles.shiftText}>▶</Text>
        </Touchable>
      </View>
    </View>
  );
}

export default function BoardScreen(): React.ReactElement {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { projects, tasks, members, subtasks, comments, moveTask } = useWorkspace();

  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus>('Backlog');

  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);

  const boardRef = useRef<View | null>(null);
  const boardOrigin = useRef({ x: 0, y: 0 });
  const columnRefs = useRef<Record<string, View | null>>({});
  const rangesRef = useRef<ColumnRange[]>([]);
  const dropTargetRef = useRef<TaskStatus | null>(null);
  const draggingTaskRef = useRef<Task | null>(null);
  const previewPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const contentWidth = width >= SIDEBAR_BREAKPOINT ? width - SIDEBAR_WIDTH : width;
  const columnWidth = Math.max(
    MIN_COLUMN_WIDTH,
    Math.floor(
      (contentWidth - spacing.xl * 2 - COLUMN_GAP * (TASK_STATUSES.length - 1)) / TASK_STATUSES.length,
    ),
  );

  /** Caches where each column sits on screen so a drop can be resolved from the pointer position. */
  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y) => {
      boardOrigin.current = { x, y };
    });
    const ranges: ColumnRange[] = [];
    TASK_STATUSES.forEach(status => {
      const node = columnRefs.current[status];
      if (!node) return;
      node.measureInWindow((x, _y, columnMeasuredWidth) => {
        ranges.push({ status, start: x, end: x + columnMeasuredWidth });
      });
    });
    rangesRef.current = ranges;
  }, []);

  const statusAt = useCallback((pageX: number): TaskStatus | null => {
    const hit = rangesRef.current.find(range => pageX >= range.start && pageX <= range.end);
    return hit ? hit.status : null;
  }, []);

  const handleDragStart = useCallback(
    (task: Task, pageX: number, pageY: number) => {
      measureBoard();
      previewPos.setValue({
        x: pageX - boardOrigin.current.x - PREVIEW_WIDTH / 2,
        y: pageY - boardOrigin.current.y - 22,
      });
      dropTargetRef.current = task.status;
      draggingTaskRef.current = task;
      setDropTarget(task.status);
      setDraggingTask(task);
    },
    [measureBoard, previewPos],
  );

  const handleDragMove = useCallback(
    (pageX: number, pageY: number) => {
      previewPos.setValue({
        x: pageX - boardOrigin.current.x - PREVIEW_WIDTH / 2,
        y: pageY - boardOrigin.current.y - 22,
      });
      const status = statusAt(pageX);
      if (status !== dropTargetRef.current) {
        dropTargetRef.current = status;
        setDropTarget(status);
      }
    },
    [previewPos, statusAt],
  );

  const clearDrag = useCallback(() => {
    dropTargetRef.current = null;
    draggingTaskRef.current = null;
    setDropTarget(null);
    setDraggingTask(null);
  }, []);

  const handleDragEnd = useCallback(
    (pageX: number) => {
      const dragged = draggingTaskRef.current;
      const target = statusAt(pageX) ?? dropTargetRef.current;
      if (dragged && target && target !== dragged.status) {
        void moveTask(dragged.id, target);
      }
      clearDrag();
    },
    [statusAt, moveTask, clearDrag],
  );

  const shiftTask = useCallback(
    (task: Task, delta: number) => {
      const next = TASK_STATUSES[TASK_STATUSES.indexOf(task.status) + delta];
      if (next) void moveTask(task.id, next);
    },
    [moveTask],
  );

  const filtered = useMemo(
    () =>
      tasks.filter(task => {
        if (projectFilter !== 'all' && task.projectId !== projectFilter) return false;
        if (assigneeFilter === 'unassigned' && task.assigneeId !== '') return false;
        if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && task.assigneeId !== assigneeFilter) {
          return false;
        }
        if (priorityFilter !== 'All' && task.priority !== priorityFilter) return false;
        if (typeFilter !== 'All' && task.type !== typeFilter) return false;
        return true;
      }),
    [tasks, projectFilter, assigneeFilter, priorityFilter, typeFilter],
  );

  const byStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      Backlog: [],
      'To Do': [],
      'In Progress': [],
      Review: [],
      Done: [],
    };
    filtered
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach(task => grouped[task.status].push(task));
    return grouped;
  }, [filtered]);

  const filtersActive =
    projectFilter !== 'all' || assigneeFilter !== 'all' || priorityFilter !== 'All' || typeFilter !== 'All';

  const openTask = useCallback((task: Task) => {
    setActiveTaskId(task.id);
    setSheetOpen(true);
  }, []);

  const openCreate = (status: TaskStatus): void => {
    setActiveTaskId(null);
    setCreateStatus(status);
    setSheetOpen(true);
  };

  const clearFilters = (): void => {
    setProjectFilter('all');
    setAssigneeFilter('all');
    setPriorityFilter('All');
    setTypeFilter('All');
  };

  const defaultProjectId = projectFilter !== 'all' ? projectFilter : projects.length > 0 ? projects[0].id : '';
  const noProjects = projects.length === 0;

  const cardCallbacks: CardCallbacks = {
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onDragCancel: clearDrag,
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.headerArea}>
        <PageHeader
          eyebrow="Execution"
          title="Board"
          subtitle={
            noProjects
              ? 'Create a project first, then plan its work here.'
              : `${filtered.length} of ${tasks.length} ${
                  tasks.length === 1 ? 'task' : 'tasks'
                } shown · drag a card between columns to change its status`
          }
          right={
            <>
              <Button
                label={filtersOpen ? 'Hide filters' : 'Show filters'}
                variant="outline"
                onPress={() => setFiltersOpen(open => !open)}
              />
              <Button label="+ New task" onPress={() => openCreate('Backlog')} disabled={noProjects} />
            </>
          }
        />

        {filtersOpen ? (
          <Card style={styles.filterCard}>
            <View style={styles.filterGrid}>
              <View style={styles.filterBlock}>
                <Text style={styles.filterLabel}>Project</Text>
                <ChipGroup
                  options={[
                    { value: 'all', label: 'All projects' },
                    ...projects.map(project => ({ value: project.id, label: project.name })),
                  ]}
                  value={projectFilter}
                  onChange={setProjectFilter}
                />
              </View>
              <View style={styles.filterBlock}>
                <Text style={styles.filterLabel}>Assignee</Text>
                <ChipGroup
                  options={[
                    { value: 'all', label: 'Anyone' },
                    { value: 'unassigned', label: 'Unassigned' },
                    ...members
                      .filter(member => member.active || tasks.some(task => task.assigneeId === member.id))
                      .map(member => ({ value: member.id, label: member.active ? member.name : `${member.name} (inactive)` })),
                  ]}
                  value={assigneeFilter}
                  onChange={setAssigneeFilter}
                />
              </View>
              <View style={styles.filterBlock}>
                <Text style={styles.filterLabel}>Priority</Text>
                <ChipGroup<PriorityFilter>
                  options={[
                    { value: 'All', label: 'Any' },
                    ...TASK_PRIORITIES.map(priority => ({
                      value: priority,
                      label: priority,
                      tone: TASK_PRIORITY_TONE[priority],
                    })),
                  ]}
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                />
              </View>
              <View style={styles.filterBlock}>
                <Text style={styles.filterLabel}>Type</Text>
                <ChipGroup<TypeFilter>
                  options={[
                    { value: 'All', label: 'Any' },
                    ...TASK_TYPES.map(type => ({ value: type, label: type, tone: TASK_TYPE_TONE[type] })),
                  ]}
                  value={typeFilter}
                  onChange={setTypeFilter}
                />
              </View>
            </View>
            {filtersActive ? (
              <View style={styles.filterFooter}>
                <Text style={styles.filterSummary}>
                  Showing {filtered.length} of {tasks.length} tasks
                </Text>
                <Button label="Clear filters" variant="ghost" small onPress={clearFilters} />
              </View>
            ) : null}
          </Card>
        ) : null}
      </View>

      {noProjects ? (
        <View style={styles.centerArea}>
          <Card style={styles.emptyCard}>
            <EmptyState
              emoji="🗂️"
              title="Your board is waiting on a project"
              message="Tasks belong to a project so progress bars and the roadmap stay accurate. Create one and come back to plan the work."
              actionLabel="Create a project"
              onAction={() => router.push('/projects')}
            />
          </Card>
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.centerArea}>
          <Card style={styles.emptyCard}>
            <EmptyState
              emoji="✨"
              title="No tasks on the board yet"
              message="Add your first task to the Backlog, then drag it across Backlog → To Do → In Progress → Review → Done as the work moves."
              actionLabel="+ New task"
              onAction={() => openCreate('Backlog')}
            />
          </Card>
        </View>
      ) : (
        <View
          style={styles.boardArea}
          ref={node => {
            boardRef.current = node;
          }}
          onLayout={measureBoard}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={styles.boardContent}
            onScroll={measureBoard}
            scrollEventThrottle={32}
          >
            {TASK_STATUSES.map(status => {
              const columnTasks = byStatus[status];
              const tone = TASK_STATUS_TONE[status];
              const isTarget = draggingTask !== null && dropTarget === status;
              return (
                <View
                  key={status}
                  ref={node => {
                    columnRefs.current[status] = node;
                  }}
                  onLayout={measureBoard}
                  style={[
                    styles.column,
                    { width: columnWidth },
                    isTarget ? { borderColor: tone.fg, backgroundColor: tone.bg } : null,
                  ]}
                >
                  <View style={styles.columnHeader}>
                    <View style={[styles.columnDot, { backgroundColor: tone.fg }]} />
                    <Text style={styles.columnTitle}>{status}</Text>
                    <View style={[styles.columnCount, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                      <Text style={[styles.columnCountText, { color: tone.fg }]}>{columnTasks.length}</Text>
                    </View>
                    <View style={styles.flexSpacer} />
                    <Touchable
                      accessibilityLabel={`Add a task to ${status}`}
                      onPress={() => openCreate(status)}
                      style={styles.addButton}
                      hoverStyle={styles.addButtonHover}
                    >
                      <Text style={styles.addButtonText}>＋</Text>
                    </Touchable>
                  </View>

                  <ScrollView
                    style={styles.columnScroll}
                    contentContainerStyle={styles.columnScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {columnTasks.length === 0 ? (
                      <Touchable
                        accessibilityLabel={`Add the first ${status} task`}
                        onPress={() => openCreate(status)}
                        style={styles.columnEmpty}
                        hoverStyle={styles.columnEmptyHover}
                      >
                        <Text style={styles.columnEmptyTitle}>
                          {filtersActive ? 'Nothing matches your filters' : 'Nothing here yet'}
                        </Text>
                        <Text style={styles.columnEmptyText}>
                          {filtersActive
                            ? 'Clear a filter, or drop a card into this column.'
                            : `Drop a card here, or click to add a ${status} task.`}
                        </Text>
                      </Touchable>
                    ) : (
                      columnTasks.map(task => {
                        const project = projects.find(item => item.id === task.projectId) ?? null;
                        const scopedSubtasks = subtasks.filter(item => item.taskId === task.id);
                        return (
                          <BoardCard
                            key={task.id}
                            task={task}
                            dimmed={draggingTask !== null && draggingTask.id === task.id}
                            assignee={memberById(members, task.assigneeId)}
                            subtaskDone={scopedSubtasks.filter(item => item.done).length}
                            subtaskTotal={scopedSubtasks.length}
                            commentCount={comments.filter(item => item.taskId === task.id).length}
                            projectColor={project ? project.color : colors.borderStrong}
                            projectName={project ? project.name : 'No project'}
                            onOpen={openTask}
                            onShift={shiftTask}
                            {...cardCallbacks}
                          />
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>

          {draggingTask ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.dragPreview, { width: PREVIEW_WIDTH, transform: previewPos.getTranslateTransform() }]}
            >
              <View style={styles.previewTop}>
                <Badge label={draggingTask.type} tone={TASK_TYPE_TONE[draggingTask.type]} />
                <Badge label={draggingTask.priority} tone={TASK_PRIORITY_TONE[draggingTask.priority]} />
              </View>
              <Text style={styles.previewTitle} numberOfLines={2}>
                {draggingTask.title}
              </Text>
              <Text style={styles.previewHint}>
                {dropTarget ? `Drop in “${dropTarget}”` : 'Drag over a column'}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      )}

      <TaskDetailSheet
        visible={sheetOpen}
        taskId={activeTaskId}
        initialStatus={createStatus}
        initialProjectId={defaultProjectId}
        onClose={() => {
          setSheetOpen(false);
          setActiveTaskId(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerArea: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  filterCard: { marginBottom: spacing.lg, padding: spacing.lg },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  filterBlock: { flexGrow: 1, flexBasis: 240, minWidth: 200 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 6,
  },
  filterFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  filterSummary: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  centerArea: { flex: 1, padding: spacing.xl },
  emptyCard: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  boardArea: { flex: 1, paddingBottom: spacing.lg },
  boardContent: { paddingHorizontal: spacing.xl, gap: COLUMN_GAP, paddingBottom: spacing.sm },
  column: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  columnHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  columnDot: { width: 8, height: 8, borderRadius: 4 },
  columnTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  columnCount: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, borderWidth: 1 },
  columnCountText: { fontSize: 11, fontWeight: '800' },
  flexSpacer: { flex: 1 },
  addButton: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  addButtonHover: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  addButtonText: { fontSize: 14, color: colors.primary, fontWeight: '800', lineHeight: 16 },
  columnScroll: { flex: 1 },
  columnScrollContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  columnEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  columnEmptyHover: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  columnEmptyTitle: { fontSize: 12.5, fontWeight: '800', color: colors.textMuted, marginBottom: 3 },
  columnEmptyText: { fontSize: 11.5, color: colors.textFaint, textAlign: 'center', lineHeight: 16 },
  cardWrap: { position: 'relative' },
  cardWrapDragging: { position: 'relative', opacity: 0.35 },
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    ...shadow.card,
  },
  taskCardHover: { borderColor: colors.primaryBorder, backgroundColor: colors.surfaceAlt },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  dragHandle: { fontSize: 13, color: colors.textFaint, fontWeight: '800' },
  taskTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text, lineHeight: 19 },
  taskProject: { fontSize: 11, color: colors.textFaint, marginTop: 4, fontWeight: '600' },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8, alignItems: 'center' },
  labelPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  labelPillText: { fontSize: 10, fontWeight: '700', color: colors.accent },
  labelMore: { fontSize: 10, fontWeight: '700', color: colors.textFaint },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingRight: 52 },
  footerMeta: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },
  duePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.slateSoft,
  },
  duePillLate: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
  },
  dueText: { fontSize: 10.5, fontWeight: '700', color: colors.textMuted },
  dueTextLate: { fontSize: 10.5, fontWeight: '700', color: '#B91C1C' },
  shiftRow: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', gap: 4 },
  shiftButton: {
    width: 22,
    height: 20,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftButtonHover: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  shiftText: { fontSize: 9, color: colors.primary, fontWeight: '800' },
  dragPreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.md,
    ...shadow.raised,
  },
  previewTop: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  previewTitle: { fontSize: 13, fontWeight: '800', color: colors.text, lineHeight: 18 },
  previewHint: { fontSize: 11, color: colors.primary, fontWeight: '700', marginTop: 6 },
});
