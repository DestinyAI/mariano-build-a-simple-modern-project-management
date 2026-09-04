import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cloudEnabled, cloudHost, retryCloud, useCloudStatus } from '../cloud';
import { relativeTime } from '../dates';
import { useWorkspace } from '../store';
import { colors, radius, spacing } from '../theme';
import { Button } from './ui';

interface Look {
  dot: string;
  label: string;
  bg: string;
  border: string;
  fg: string;
}

function lookFor(state: string): Look {
  switch (state) {
    case 'online':
      return { dot: '#10B981', label: 'Cloud synced', bg: colors.successSoft, border: '#A7F3D0', fg: '#047857' };
    case 'connecting':
      return { dot: colors.accent, label: 'Syncing…', bg: colors.accentSoft, border: colors.accentBorder, fg: colors.accent };
    case 'offline':
      return { dot: colors.danger, label: 'Cloud offline', bg: colors.dangerSoft, border: '#FECACA', fg: '#B91C1C' };
    default:
      return { dot: colors.slate, label: 'Local only', bg: colors.slateSoft, border: '#E2E8F0', fg: colors.slate };
  }
}

/** Compact connection chip for the sidebar. */
export function SyncPill(): React.ReactElement {
  const status = useCloudStatus();
  const look = lookFor(status.state);
  return (
    <View style={[styles.pill, { backgroundColor: look.bg, borderColor: look.border }]}>
      <View style={[styles.dot, { backgroundColor: look.dot }]} />
      <Text style={[styles.pillLabel, { color: look.fg }]} numberOfLines={1}>
        {look.label}
      </Text>
    </View>
  );
}

/**
 * Explains, in the product itself, where the workspace data actually lives —
 * a shared cloud database, or just this browser — and lets the user re-sync.
 */
export function SyncNotice(): React.ReactElement {
  const status = useCloudStatus();
  const { refresh, refreshing } = useWorkspace();
  const look = lookFor(status.state);

  const heading = cloudEnabled
    ? status.state === 'offline'
      ? 'Shared database unreachable'
      : 'Shared cloud workspace'
    : 'Local workspace (this browser)';

  const body = cloudEnabled
    ? status.state === 'offline'
      ? `Your changes are saved on this device and will upload automatically once ${cloudHost || 'the database'} answers again.`
      : `Projects, tasks, subtasks, comments and the team directory are stored in the shared database at ${cloudHost}, so every teammate opening this link sees the same board and the same members.`
    : 'By design, not a bug: this deployment ships without database credentials, so everything is saved locally in your browser and stays on this device. Set EXPO_PUBLIC_DATA_API_URL and EXPO_PUBLIC_DATA_API_AUTH_URL (schema in db/schema.sql) and the same screens sync to the shared cloud database instead.';

  return (
    <View style={[styles.notice, { backgroundColor: look.bg, borderColor: look.border }]}>
      <View style={styles.noticeMain}>
        <View style={styles.noticeHeader}>
          <View style={[styles.dot, { backgroundColor: look.dot }]} />
          <Text style={[styles.noticeTitle, { color: look.fg }]}>{heading}</Text>
        </View>
        <Text style={styles.noticeBody}>{body}</Text>
        <View style={styles.metaRow}>
          {status.lastSyncedAt ? (
            <Text style={styles.meta}>Last synced {relativeTime(status.lastSyncedAt)}</Text>
          ) : null}
          {status.pendingWrites > 0 ? (
            <Text style={styles.meta}>
              {status.pendingWrites} change{status.pendingWrites === 1 ? '' : 's'} waiting to upload
            </Text>
          ) : null}
          {cloudEnabled && status.state === 'offline' ? <Text style={styles.meta}>{status.detail}</Text> : null}
        </View>
      </View>
      {cloudEnabled ? (
        <View style={styles.actions}>
          <Button
            label={refreshing ? 'Refreshing…' : 'Refresh'}
            variant="outline"
            small
            disabled={refreshing}
            onPress={() => {
              void refresh();
            }}
          />
          {status.state === 'offline' ? (
            <Button
              label="Retry sync"
              variant="primary"
              small
              onPress={() => {
                void retryCloud().then(refresh);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  pillLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexWrap: 'wrap',
  },
  noticeMain: { flexGrow: 1, flexShrink: 1, flexBasis: 320, gap: 6 },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeTitle: { fontSize: 13, fontWeight: '800' },
  noticeBody: { fontSize: 12.5, lineHeight: 18, color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  meta: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
