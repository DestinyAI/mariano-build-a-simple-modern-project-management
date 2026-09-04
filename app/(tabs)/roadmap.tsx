import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, EmptyState, PageHeader, SectionTitle } from '../../src/components/ui';
import {
  ToneColors,
  PROJECT_STATUS_TONE,
  TASK_STATUS_TONE,
  colors,
  radius,
  spacing,
} from '../../src/theme';
import {
  daysInMonth,
  formatShortDate,
  isOverdue,
  monthLabel,
  monthRange,
  parseISODate,
  toISODate,
} from '../../src/dates';
import { progressForProject, useWorkspace } from '../../src/store';

const MONTH_WIDTH = 112;
const ROW_HEIGHT = 46;
const LABEL_WIDTH = 214;
const HEADER_HEIGHT = 38;
const MIN_BAR_WIDTH = 28;

interface RoadmapRow {
  key: string;
  kind: 'project' | 'feature';
  label: string;
  sublabel: string;
  color: string;
  start: Date | null;
  end: Date | null;
  badge: string;
  badgeTone: ToneColors;
  percent: number;
  late: boolean;
}

export default function RoadmapScreen(): React.ReactElement {
  const router = useRouter();
  const { projects, tasks } = useWorkspace();

  const rows = useMemo<RoadmapRow[]>(() => {
    const output: RoadmapRow[] = [];
    const ordered = projects
      .slice()
      .sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'));

    ordered.forEach(project => {
      const progress = progressForProject(tasks, project.id, isOverdue);
      output.push({
        key: `project-${project.id}`,
        kind: 'project',
        label: project.name,
        sublabel: `${progress.done}/${progress.total} tasks · ${progress.percent}%`,
        color: project.color,
        start: parseISODate(project.startDate),
        end: parseISODate(project.targetDate),
        badge: project.status,
        badgeTone: PROJECT_STATUS_TONE[project.status],
        percent: progress.percent,
        late: project.status !== 'Completed' && isOverdue(project.targetDate),
      });

      tasks
        .filter(task => task.projectId === project.id && task.type === 'Feature')
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
        .forEach(task => {
          const created = parseISODate(task.createdAt.slice(0, 10));
          const due = parseISODate(task.dueDate);
          // A feature bar runs from when it was raised to when it is due.
          const start = created && due && created.getTime() > due.getTime() ? due : created;
          output.push({
            key: `task-${task.id}`,
            kind: 'feature',
            label: task.title,
            sublabel: task.dueDate ? `Due ${formatShortDate(task.dueDate)}` : 'No due date set',
            color: project.color,
            start: start ?? parseISODate(project.startDate),
            end: due,
            badge: task.status,
            badgeTone: TASK_STATUS_TONE[task.status],
            percent: task.status === 'Done' ? 100 : 0,
            late: task.status !== 'Done' && isOverdue(task.dueDate),
          });
        });
    });

    return output;
  }, [projects, tasks]);

  const months = useMemo(() => {
    const dates: Date[] = [new Date()];
    rows.forEach(row => {
      if (row.start) dates.push(row.start);
      if (row.end) dates.push(row.end);
    });
    const min = new Date(Math.min(...dates.map(date => date.getTime())));
    const max = new Date(Math.max(...dates.map(date => date.getTime())));
    return monthRange(
      new Date(min.getFullYear(), min.getMonth() - 1, 1),
      new Date(max.getFullYear(), max.getMonth() + 1, 1),
    );
  }, [rows]);

  const timelineWidth = months.length * MONTH_WIDTH;

  const offsetFor = (date: Date): number => {
    const first = months[0];
    if (!first) return 0;
    const monthsElapsed = (date.getFullYear() - first.year) * 12 + (date.getMonth() - first.monthIndex);
    const fraction = (date.getDate() - 1) / daysInMonth(date.getFullYear(), date.getMonth());
    return (monthsElapsed + fraction) * MONTH_WIDTH;
  };

  const todayOffset = offsetFor(new Date());
  const featureCount = rows.filter(row => row.kind === 'feature').length;
  const undated = rows.filter(row => row.start === null || row.end === null).length;

  if (projects.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.inner}>
            <PageHeader
              eyebrow="Planning"
              title="Roadmap"
              subtitle="A month-by-month view of every project and feature."
            />
            <Card>
              <EmptyState
                emoji="🗓️"
                title="Nothing on the roadmap yet"
                message="Projects appear here as bars running from their start date to their target date, with their Feature tasks nested underneath. Create a project with dates and it shows up straight away."
                actionLabel="Create a project"
                onAction={() => router.push('/projects')}
              />
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <PageHeader
            eyebrow="Planning"
            title="Roadmap"
            subtitle={`${projects.length} ${projects.length === 1 ? 'project' : 'projects'} and ${featureCount} ${
              featureCount === 1 ? 'feature' : 'features'
            } across ${months.length} months`}
            right={<Button label="Add a project" variant="outline" onPress={() => router.push('/projects')} />}
          />

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Project span</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.legendFeature]} />
              <Text style={styles.legendText}>Feature</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendToday} />
              <Text style={styles.legendText}>Today</Text>
            </View>
            {undated > 0 ? (
              <Text style={styles.legendNote}>
                {undated} {undated === 1 ? 'item is' : 'items are'} missing a start or target date
              </Text>
            ) : null}
          </View>

          <Card style={styles.timelineCard}>
            <View style={styles.timelineRow}>
              <View style={styles.labelColumn}>
                <View style={styles.labelHeader}>
                  <Text style={styles.labelHeaderText}>Project / feature</Text>
                </View>
                {rows.map(row => (
                  <View
                    key={row.key}
                    style={[styles.labelCell, row.kind === 'feature' ? styles.labelCellFeature : null]}
                  >
                    <View style={[styles.labelDot, { backgroundColor: row.color }]} />
                    <View style={styles.labelTextWrap}>
                      <Text
                        style={row.kind === 'feature' ? styles.labelTextFeature : styles.labelText}
                        numberOfLines={1}
                      >
                        {row.label}
                      </Text>
                      <Text style={styles.labelSub} numberOfLines={1}>
                        {row.sublabel}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.gridScroll}>
                <View style={{ width: timelineWidth }}>
                  <View style={styles.monthHeader}>
                    {months.map(month => (
                      <View key={`${month.year}-${month.monthIndex}`} style={styles.monthCell}>
                        <Text style={styles.monthText}>{monthLabel(month.year, month.monthIndex)}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.trackArea}>
                    <View style={styles.gridLines} pointerEvents="none">
                      {months.map(month => (
                        <View key={`grid-${month.year}-${month.monthIndex}`} style={styles.gridCell} />
                      ))}
                    </View>

                    {rows.map(row => {
                      if (!row.start || !row.end) {
                        return (
                          <View key={row.key} style={styles.trackRow}>
                            <View
                              style={[
                                styles.missingBar,
                                { left: Math.max(0, offsetFor(row.start ?? row.end ?? new Date())) },
                              ]}
                            >
                              <Text style={styles.missingText}>Needs a start &amp; target date</Text>
                            </View>
                          </View>
                        );
                      }
                      const left = offsetFor(row.start);
                      const barWidth = Math.max(MIN_BAR_WIDTH, offsetFor(row.end) - left);
                      return (
                        <View key={row.key} style={styles.trackRow}>
                          <View
                            style={[
                              styles.bar,
                              row.kind === 'feature' ? styles.barFeature : null,
                              {
                                left,
                                width: barWidth,
                                backgroundColor: row.kind === 'project' ? row.color : colors.surface,
                                borderColor: row.color,
                              },
                            ]}
                          >
                            {row.kind === 'project' ? (
                              <View
                                style={[
                                  styles.barProgress,
                                  { width: `${Math.max(0, Math.min(100, row.percent))}%` },
                                ]}
                              />
                            ) : null}
                            <Text
                              style={row.kind === 'project' ? styles.barText : [styles.barText, { color: row.color }]}
                              numberOfLines={1}
                            >
                              {row.kind === 'project'
                                ? `${row.percent}% · ${formatShortDate(toISODate(row.end))}`
                                : formatShortDate(toISODate(row.end))}
                            </Text>
                          </View>
                          {row.late ? <View style={[styles.lateDot, { left: left + barWidth + 6 }]} /> : null}
                        </View>
                      );
                    })}

                    <View style={[styles.todayLine, { left: todayOffset }]} pointerEvents="none" />
                  </View>
                </View>
              </ScrollView>
            </View>
          </Card>

          <View style={styles.summaryBlock}>
            <SectionTitle title="Milestones by project" />
            <View style={styles.summaryGrid}>
              {projects.map(project => {
                const progress = progressForProject(tasks, project.id, isOverdue);
                const features = tasks.filter(task => task.projectId === project.id && task.type === 'Feature');
                return (
                  <View key={project.id} style={[styles.summaryCard, { borderTopColor: project.color }]}>
                    <View style={styles.summaryHeader}>
                      <Text style={styles.summaryName} numberOfLines={1}>
                        {project.name}
                      </Text>
                      <Badge label={project.status} tone={PROJECT_STATUS_TONE[project.status]} />
                    </View>
                    <Text style={styles.summaryMeta}>
                      {project.startDate ? formatShortDate(project.startDate) : '—'} →{' '}
                      {project.targetDate ? formatShortDate(project.targetDate) : 'no target'}
                    </Text>
                    <Text style={styles.summaryMeta}>
                      {features.length} {features.length === 1 ? 'feature' : 'features'} · {progress.done}/
                      {progress.total} tasks done
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  inner: { width: '100%', maxWidth: 1280, alignSelf: 'center' },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 18, height: 10, borderRadius: 3 },
  legendFeature: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent },
  legendToday: { width: 2, height: 14, backgroundColor: colors.danger, borderRadius: 1 },
  legendText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  legendNote: { fontSize: 11.5, color: colors.textFaint, fontStyle: 'italic' },
  timelineCard: { padding: 0, overflow: 'hidden' },
  timelineRow: { flexDirection: 'row' },
  labelColumn: {
    width: LABEL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  labelHeader: {
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  labelHeaderText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  labelCell: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  labelCellFeature: { paddingLeft: spacing.xl },
  labelDot: { width: 8, height: 8, borderRadius: 4 },
  labelTextWrap: { flex: 1 },
  labelText: { fontSize: 13, fontWeight: '800', color: colors.text },
  labelTextFeature: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  labelSub: { fontSize: 10.5, color: colors.textFaint, marginTop: 1 },
  gridScroll: { flexGrow: 1 },
  monthHeader: {
    flexDirection: 'row',
    height: HEADER_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  monthCell: {
    width: MONTH_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  monthText: { fontSize: 11.5, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.3 },
  trackArea: { position: 'relative' },
  gridLines: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  gridCell: { width: MONTH_WIDTH, borderRightWidth: 1, borderRightColor: colors.border, height: '100%' },
  trackRow: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bar: {
    position: 'absolute',
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  barFeature: { height: 20 },
  barProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  barText: { fontSize: 10.5, fontWeight: '800', color: colors.white },
  lateDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    alignSelf: 'center',
  },
  missingBar: {
    position: 'absolute',
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceAlt,
  },
  missingText: { fontSize: 10, color: colors.textFaint, fontWeight: '700' },
  todayLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.danger,
    opacity: 0.7,
  },
  summaryBlock: { marginTop: spacing.xl },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  summaryCard: {
    flexGrow: 1,
    flexBasis: 250,
    minWidth: 230,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    padding: spacing.lg,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  summaryName: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.text },
  summaryMeta: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
});
