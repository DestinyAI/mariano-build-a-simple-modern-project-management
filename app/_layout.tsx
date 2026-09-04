import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/auth';
import { SyncPill } from '../src/components/SyncStatus';
import { Avatar, Touchable } from '../src/components/ui';
import { WorkspaceProvider, useWorkspace } from '../src/store';
import { colors, radius, spacing } from '../src/theme';
import LoginScreen from '../src/components/LoginScreen';

/** Above this width the tab bar becomes a persistent left sidebar. */
const SIDEBAR_BREAKPOINT = 900;
const SIDEBAR_WIDTH = 236;

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

interface NavMeta {
  label: string;
  icon: string;
  hint: string;
}

const NAV_META: Record<string, NavMeta> = {
  index: { label: 'Dashboard', icon: '📊', hint: 'Progress at a glance' },
  projects: { label: 'Projects', icon: '📁', hint: 'Plan and track work' },
  board: { label: 'Board', icon: '🗂️', hint: 'Kanban workflow' },
  roadmap: { label: 'Roadmap', icon: '🗓️', hint: 'Monthly timeline' },
  team: { label: 'Team', icon: '👥', hint: 'Users and roles' },
};

const NAV_ORDER = ['index', 'projects', 'board', 'roadmap', 'team'];

function baseName(routeName: string): string {
  const parts = routeName.split('/');
  return parts[parts.length - 1];
}

function metaFor(routeName: string): NavMeta {
  return NAV_META[baseName(routeName)] ?? { label: baseName(routeName), icon: '•', hint: '' };
}

function WorkspaceNav({ state, navigation }: TabBarProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { projects, tasks, members, currentMemberId } = useWorkspace();
  const { user, signOut } = useAuth();
  const isSidebar = width >= SIDEBAR_BREAKPOINT;

  const ordered = state.routes
    .map((route, index) => ({ route, index }))
    .sort((a, b) => {
      const first = NAV_ORDER.indexOf(baseName(a.route.name));
      const second = NAV_ORDER.indexOf(baseName(b.route.name));
      return (first === -1 ? 99 : first) - (second === -1 ? 99 : second);
    });

  const go = (routeKey: string, routeName: string, focused: boolean): void => {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const openTasks = tasks.filter(task => task.status !== 'Done').length;
  const activeMembers = members.filter(member => member.active).length;
  const actingAs = members.find(member => member.id === currentMemberId) ?? null;

  if (isSidebar) {
    return (
      <View
        style={[
          styles.sidebar,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>TF</Text>
          </View>
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>TeamFlow</Text>
            <Text style={styles.brandTag}>Project workspace</Text>
          </View>
        </View>

        <View style={styles.navList}>
          {ordered.map(({ route, index }) => {
            const focused = state.index === index;
            const meta = metaFor(route.name);
            return (
              <Touchable
                key={route.key}
                accessibilityLabel={meta.label}
                onPress={() => go(route.key, route.name, focused)}
                style={[styles.navItem, focused ? styles.navItemActive : null]}
                hoverStyle={focused ? null : styles.navItemHover}
              >
                <View style={[styles.navRail, focused ? styles.navRailActive : null]} />
                <Text style={styles.navIcon}>{meta.icon}</Text>
                <View style={styles.navTextWrap}>
                  <Text style={[styles.navLabel, focused ? styles.navLabelActive : null]} numberOfLines={1}>
                    {meta.label}
                  </Text>
                  <Text style={styles.navHint} numberOfLines={1}>
                    {meta.hint}
                  </Text>
                </View>
              </Touchable>
            );
          })}
        </View>

        <View style={styles.sidebarFooter}>
          <SyncPill />
          <Text style={styles.footerLabel}>Workspace</Text>
          <Text style={styles.footerValue}>
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </Text>
          <Text style={styles.footerValue}>
            {openTasks} open {openTasks === 1 ? 'task' : 'tasks'}
          </Text>
          <Text style={styles.footerValue}>
            {activeMembers} active {activeMembers === 1 ? 'member' : 'members'}
          </Text>
          {actingAs ? (
            <View style={styles.actingRow}>
              <Avatar member={actingAs} size={22} />
              <View style={styles.actingTextWrap}>
                <Text style={styles.actingLabel}>Acting as</Text>
                <Text style={styles.actingName} numberOfLines={1}>
                  {actingAs.name}
                </Text>
              </View>
            </View>
          ) : null}

          <Touchable
            accessibilityLabel="Cerrar sesión"
            onPress={() => void signOut()}
            style={styles.logoutButton}
            hoverStyle={styles.logoutButtonHover}
          >
            <Text style={styles.logoutText}>
              {user ? `Cerrar sesión · ${user.displayName}` : 'Cerrar sesión'}
            </Text>
          </Touchable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {ordered.map(({ route, index }) => {
        const focused = state.index === index;
        const meta = metaFor(route.name);
        return (
          <Touchable
            key={route.key}
            accessibilityLabel={meta.label}
            onPress={() => go(route.key, route.name, focused)}
            style={styles.bottomItem}
            hoverStyle={styles.bottomItemHover}
          >
            <Text style={[styles.bottomIcon, focused ? styles.bottomIconActive : null]}>{meta.icon}</Text>
            <Text style={[styles.bottomLabel, focused ? styles.bottomLabelActive : null]} numberOfLines={1}>
              {meta.label}
            </Text>
          </Touchable>
        );
      })}
      <Touchable
        accessibilityLabel="Cerrar sesión"
        onPress={() => void signOut()}
        style={styles.bottomItem}
        hoverStyle={styles.bottomItemHover}
      >
        <Text style={styles.bottomIcon}>🚪</Text>
        <Text style={styles.bottomLabel} numberOfLines={1}>
          Salir
        </Text>
      </Touchable>
    </View>
  );
}

function TabsHost(): React.ReactElement {
  const { width } = useWindowDimensions();
  const isSidebar = width >= SIDEBAR_BREAKPOINT;
  return (
    <Tabs
      tabBar={props => <WorkspaceNav {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isSidebar ? 'left' : 'bottom',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

/** Decides between the login screen and the workspace once the session is known. */
function AuthGate(): React.ReactElement | null {
  const { ready, user } = useAuth();
  if (!ready) return null;
  if (!user) return <LoginScreen />;
  return (
    <WorkspaceProvider>
      <TabsHost />
    </WorkspaceProvider>
  );
}

export default function RootLayout(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xl,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: colors.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  brandTextWrap: { flexShrink: 1 },
  brandName: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  brandTag: { fontSize: 11.5, color: colors.textFaint, marginTop: 1 },
  navList: { gap: 4 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    paddingRight: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  navItemHover: { backgroundColor: colors.surfaceAlt },
  navItemActive: { backgroundColor: colors.primarySoft },
  navRail: { width: 3, height: 26, borderRadius: 2, backgroundColor: 'transparent' },
  navRailActive: { backgroundColor: colors.primary },
  navIcon: { fontSize: 17, width: 22, textAlign: 'center' },
  navTextWrap: { flexShrink: 1 },
  navLabel: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  navLabelActive: { color: colors.primary },
  navHint: { fontSize: 10.5, color: colors.textFaint, marginTop: 1 },
  sidebarFooter: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 4,
  },
  footerValue: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  actingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actingTextWrap: { flexShrink: 1 },
  actingLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textFaint },
  actingName: { fontSize: 12, fontWeight: '700', color: colors.text },
  logoutButton: {
    marginTop: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  logoutButtonHover: { backgroundColor: colors.dangerSoft, borderColor: '#FECACA' },
  logoutText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  bottomItemHover: { backgroundColor: colors.surfaceAlt },
  bottomIcon: { fontSize: 18, opacity: 0.55 },
  bottomIconActive: { opacity: 1 },
  bottomLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  bottomLabelActive: { color: colors.primary },
});
