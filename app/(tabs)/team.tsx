import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SyncNotice } from '../../src/components/SyncStatus';
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
import { formatDate, isOverdue } from '../../src/dates';
import { MemberDraft, memberById, useWorkspace, workloadFor } from '../../src/store';
import {
  MEMBER_ACTIVE_TONE,
  MEMBER_COLORS,
  MEMBER_INACTIVE_TONE,
  MEMBER_ROLE_TONE,
  colors,
  radius,
  shadow,
  spacing,
} from '../../src/theme';
import { MEMBER_ROLES, Member, MemberRole } from '../../src/types';

type MemberFilter = 'All' | 'Active' | 'Inactive' | MemberRole;

const MEMBER_FILTERS: MemberFilter[] = ['All', 'Active', 'Inactive', ...MEMBER_ROLES];

/** Very small email sanity check — enough to catch a typo, not a validation library. */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function draftFor(member: Member): MemberDraft {
  return {
    name: member.name,
    email: member.email,
    role: member.role,
    color: member.color,
    active: member.active,
  };
}

export default function TeamScreen(): React.ReactElement {
  const router = useRouter();
  const {
    ready,
    members,
    tasks,
    projects,
    currentMemberId,
    createMember,
    updateMember,
    setMemberActive,
    deleteMember,
    setCurrentMember,
  } = useWorkspace();

  const [filter, setFilter] = useState<MemberFilter>('All');
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Member | null>(null);

  const emptyDraft = useMemo<MemberDraft>(
    () => ({
      name: '',
      email: '',
      role: 'Member',
      color: MEMBER_COLORS[members.length % MEMBER_COLORS.length],
      active: true,
    }),
    [members.length],
  );

  const [draft, setDraft] = useState<MemberDraft>(emptyDraft);

  const currentMember = memberById(members, currentMemberId);
  const activeMembers = useMemo(() => members.filter(member => member.active), [members]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members
      .filter(member => {
        if (filter === 'Active' && !member.active) return false;
        if (filter === 'Inactive' && member.active) return false;
        if (filter !== 'All' && filter !== 'Active' && filter !== 'Inactive' && member.role !== filter) {
          return false;
        }
        if (term.length === 0) return true;
        return (
          member.name.toLowerCase().includes(term) ||
          member.email.toLowerCase().includes(term) ||
          member.role.toLowerCase().includes(term)
        );
      })
      .slice()
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        const roleGap = MEMBER_ROLES.indexOf(a.role) - MEMBER_ROLES.indexOf(b.role);
        if (roleGap !== 0) return roleGap;
        return a.name.localeCompare(b.name);
      });
  }, [members, filter, search]);

  const countFor = (option: MemberFilter): number => {
    if (option === 'All') return members.length;
    if (option === 'Active') return activeMembers.length;
    if (option === 'Inactive') return members.length - activeMembers.length;
    return members.filter(member => member.role === option).length;
  };

  const openCreate = (): void => {
    setEditing(null);
    setDraft(emptyDraft);
    setShowErrors(false);
    setSheetOpen(true);
  };

  const openEdit = (member: Member): void => {
    setEditing(member);
    setDraft(draftFor(member));
    setShowErrors(false);
    setSheetOpen(true);
  };

  const nameError = draft.name.trim().length === 0;
  const emailError = draft.email.trim().length > 0 && !isValidEmail(draft.email);
  const duplicateEmail =
    draft.email.trim().length > 0 &&
    members.some(
      member =>
        member.id !== (editing ? editing.id : '') &&
        member.email.trim().toLowerCase() === draft.email.trim().toLowerCase(),
    );
  const hasError = nameError || emailError || duplicateEmail;

  const submit = (): void => {
    if (hasError) {
      setShowErrors(true);
      return;
    }
    if (editing) {
      void updateMember({
        ...editing,
        name: draft.name,
        email: draft.email,
        role: draft.role,
        color: draft.color,
        active: draft.active,
      });
    } else {
      void createMember(draft);
    }
    setSheetOpen(false);
    setEditing(null);
  };

  const confirmDelete = (): void => {
    if (pendingDelete) void deleteMember(pendingDelete.id);
    setPendingDelete(null);
  };

  const totalOpenTasks = tasks.filter(task => task.status !== 'Done').length;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <PageHeader
            eyebrow="Users"
            title="Team"
            subtitle={
              ready
                ? `${members.length} ${members.length === 1 ? 'member' : 'members'} · ${
                    activeMembers.length
                  } active · ${totalOpenTasks} open ${totalOpenTasks === 1 ? 'task' : 'tasks'} to share out`
                : 'Loading the team directory…'
            }
            right={<Button label="+ Add member" onPress={openCreate} />}
          />

          <View style={styles.syncNotice}>
            <SyncNotice />
          </View>

          <Card style={styles.actingCard}>
            <View style={styles.actingHeader}>
              <Avatar member={currentMember} size={44} />
              <View style={styles.actingText}>
                <Text style={styles.actingLabel}>You are acting as</Text>
                <Text style={styles.actingName}>{currentMember ? currentMember.name : 'Nobody yet'}</Text>
                <Text style={styles.actingHint}>
                  New tasks, comments and activity entries are attributed to this member on every device that
                  opens the shared workspace.
                </Text>
              </View>
            </View>
            {activeMembers.length === 0 ? (
              <Text style={styles.mutedText}>Add an active member to attribute work to somebody.</Text>
            ) : (
              <ChipGroup
                options={activeMembers.map(member => ({ value: member.id, label: member.name }))}
                value={currentMemberId}
                onChange={value => void setCurrentMember(value)}
                style={styles.actingChips}
              />
            )}
          </Card>

          <View style={styles.toolbar}>
            <ChipGroup
              options={MEMBER_FILTERS.map(option => ({ value: option, label: `${option} (${countFor(option)})` }))}
              value={filter}
              onChange={setFilter}
            />
            <TextField
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, email or role…"
              style={styles.search}
            />
          </View>

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                emoji="👥"
                title={members.length === 0 ? 'No team members yet' : 'No members match this view'}
                message={
                  members.length === 0
                    ? 'Add the people you work with. Members are stored in the shared cloud database, so everyone opening this link picks their assignees from the same directory.'
                    : 'Nothing matches this filter or search. Clear the search box, switch back to All, or add a new member.'
                }
                actionLabel="+ Add member"
                onAction={openCreate}
              />
            </Card>
          ) : (
            <View style={styles.list}>
              {visible.map(member => {
                const workload = workloadFor(tasks, member.id, isOverdue);
                const totalTasks = workload.assigned + workload.completed;
                const percent = totalTasks === 0 ? 0 : Math.round((workload.completed / totalTasks) * 100);
                const owned = projects.filter(project => project.ownerId === member.id);
                const isCurrent = member.id === currentMemberId;
                return (
                  <Card key={member.id} style={styles.memberCard}>
                    <View style={[styles.colorRail, { backgroundColor: member.color }]} />
                    <View style={styles.cardBody}>
                      <View style={styles.cardHeader}>
                        <Avatar member={member} size={44} />
                        <View style={styles.identity}>
                          <View style={styles.nameRow}>
                            <Text style={styles.memberName}>{member.name}</Text>
                            <Badge label={member.role} tone={MEMBER_ROLE_TONE[member.role]} />
                            <Badge
                              label={member.active ? 'Active' : 'Inactive'}
                              tone={member.active ? MEMBER_ACTIVE_TONE : MEMBER_INACTIVE_TONE}
                            />
                            {isCurrent ? (
                              <Badge
                                label="Acting as you"
                                tone={{ fg: colors.accent, bg: colors.accentSoft, border: colors.accentBorder }}
                              />
                            ) : null}
                          </View>
                          <Text style={styles.memberEmail}>
                            {member.email.length > 0 ? `✉️ ${member.email}` : 'No email on file'}
                          </Text>
                          <Text style={styles.memberMeta}>
                            {member.createdAt ? `Joined ${formatDate(member.createdAt)}` : 'Founding member'}
                            {owned.length > 0
                              ? ` · owns ${owned.length} ${owned.length === 1 ? 'project' : 'projects'}`
                              : ''}
                          </Text>
                        </View>
                        <View style={styles.cardActions}>
                          {!isCurrent && member.active ? (
                            <Button
                              label="Act as"
                              variant="ghost"
                              small
                              onPress={() => void setCurrentMember(member.id)}
                            />
                          ) : null}
                          <Button label="Edit" variant="outline" small onPress={() => openEdit(member)} />
                          <Button
                            label={member.active ? 'Deactivate' : 'Reactivate'}
                            variant="outline"
                            small
                            onPress={() => void setMemberActive(member.id, !member.active)}
                          />
                          <Button
                            label="Delete"
                            variant="danger"
                            small
                            disabled={members.length === 1}
                            onPress={() => setPendingDelete(member)}
                          />
                        </View>
                      </View>

                      <View style={styles.workloadRow}>
                        <View style={styles.workloadTile}>
                          <Text style={[styles.workloadValue, { color: colors.primary }]}>{workload.assigned}</Text>
                          <Text style={styles.workloadLabel}>Assigned open</Text>
                        </View>
                        <View style={styles.workloadTile}>
                          <Text style={[styles.workloadValue, { color: colors.accent }]}>{workload.inProgress}</Text>
                          <Text style={styles.workloadLabel}>In progress</Text>
                        </View>
                        <View style={styles.workloadTile}>
                          <Text style={[styles.workloadValue, { color: '#047857' }]}>{workload.completed}</Text>
                          <Text style={styles.workloadLabel}>Completed</Text>
                        </View>
                        <View style={styles.workloadTile}>
                          <Text
                            style={[
                              styles.workloadValue,
                              { color: workload.overdue > 0 ? colors.danger : colors.textFaint },
                            ]}
                          >
                            {workload.overdue}
                          </Text>
                          <Text style={styles.workloadLabel}>Overdue</Text>
                        </View>
                      </View>

                      <View style={styles.progressBlock}>
                        <View style={styles.progressRow}>
                          <Text style={styles.progressLabel}>
                            {totalTasks === 0
                              ? 'No tasks assigned yet'
                              : `${workload.completed} of ${totalTasks} assigned tasks done`}
                          </Text>
                          <Text style={[styles.progressPercent, { color: member.color }]}>{percent}%</Text>
                        </View>
                        <ProgressBar percent={percent} color={member.color} />
                      </View>

                      <Touchable
                        accessibilityLabel={`See ${member.name}'s tasks on the board`}
                        onPress={() => router.push('/board')}
                        style={styles.linkChip}
                        hoverStyle={styles.linkChipHover}
                      >
                        <Text style={styles.linkChipText}>See their tasks on the board →</Text>
                      </Touchable>
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
        title={editing ? 'Edit member' : 'Add team member'}
        subtitle={
          editing
            ? 'Update this teammate’s profile, role or access. Saved to the shared database for everyone.'
            : 'New members go straight into the shared database, so every teammate can assign work to them.'
        }
        onClose={() => setSheetOpen(false)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setSheetOpen(false)} />
            <Button label={editing ? 'Save changes' : 'Add member'} onPress={submit} />
          </>
        }
      >
        <Field label="Full name">
          <TextField
            value={draft.name}
            onChangeText={value => setDraft({ ...draft, name: value })}
            placeholder="Ada Lovelace"
            invalid={showErrors && nameError}
          />
          {showErrors && nameError ? <Text style={styles.error}>A member needs a name.</Text> : null}
        </Field>

        <Field label="Email" hint="Optional, but it makes the directory much easier to search.">
          <TextField
            value={draft.email}
            onChangeText={value => setDraft({ ...draft, email: value })}
            placeholder="ada@teamflow.dev"
            invalid={showErrors && (emailError || duplicateEmail)}
          />
          {showErrors && emailError ? <Text style={styles.error}>That does not look like an email address.</Text> : null}
          {showErrors && !emailError && duplicateEmail ? (
            <Text style={styles.error}>Another member already uses this email.</Text>
          ) : null}
        </Field>

        <Field label="Role" hint="Roles are shown as badges across the workspace.">
          <ChipGroup
            options={MEMBER_ROLES.map(role => ({ value: role, label: role, tone: MEMBER_ROLE_TONE[role] }))}
            value={draft.role}
            onChange={role => setDraft({ ...draft, role })}
          />
        </Field>

        <Field label="Avatar colour" hint={`Initials: ${draft.name.trim().length > 0 ? draft.name : '—'}`}>
          <View style={styles.swatchRow}>
            {MEMBER_COLORS.map(color => (
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

        <Field label="Status" hint="Inactive members keep their history but disappear from assignee pickers.">
          <ChipGroup
            options={[
              { value: 'active', label: 'Active', tone: MEMBER_ACTIVE_TONE },
              { value: 'inactive', label: 'Inactive', tone: MEMBER_INACTIVE_TONE },
            ]}
            value={draft.active ? 'active' : 'inactive'}
            onChange={value => setDraft({ ...draft, active: value === 'active' })}
          />
        </Field>
      </SheetModal>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete member?"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed from the shared directory. Their ${
                tasks.filter(task => task.assigneeId === pendingDelete.id).length
              } assigned task(s) stay in the workspace but become unassigned. Deactivate instead if you only want to hide them.`
            : ''
        }
        confirmLabel="Delete member"
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
  syncNotice: { marginBottom: spacing.lg },
  actingCard: { marginBottom: spacing.lg },
  actingHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  actingText: { flex: 1, minWidth: 200 },
  actingLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  actingName: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 },
  actingHint: { fontSize: 12.5, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  actingChips: { marginTop: spacing.lg },
  mutedText: { fontSize: 13, color: colors.textMuted, marginTop: spacing.md, lineHeight: 19 },
  toolbar: { gap: spacing.md, marginBottom: spacing.lg },
  search: { maxWidth: 360 },
  list: { gap: spacing.lg },
  memberCard: { padding: 0, overflow: 'hidden', flexDirection: 'row' },
  colorRail: { width: 6 },
  cardBody: { flex: 1, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', flexWrap: 'wrap' },
  identity: { flex: 1, minWidth: 220 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  memberName: { fontSize: 17, fontWeight: '800', color: colors.text },
  memberEmail: { fontSize: 13, color: colors.textMuted, marginTop: 5 },
  memberMeta: { fontSize: 11.5, color: colors.textFaint, marginTop: 3 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  workloadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  workloadTile: {
    flexGrow: 1,
    flexBasis: 110,
    minWidth: 100,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  workloadValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  workloadLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 1 },
  progressBlock: { marginTop: spacing.lg },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  progressPercent: { fontSize: 14, fontWeight: '800' },
  linkChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
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
