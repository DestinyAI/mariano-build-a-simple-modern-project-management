import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { ToneColors, colors, radius, shadow, spacing } from '../theme';
import { Member } from '../types';

/* ------------------------------------------------------------------ Touchable */

interface TouchableProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  hoverStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  children?: React.ReactNode;
  accessibilityLabel?: string;
}

/** Pressable with an explicit mouse-hover state and a pointer cursor, for the web build. */
export function Touchable({
  onPress,
  style,
  hoverStyle,
  disabled = false,
  children,
  accessibilityLabel,
}: TouchableProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        style,
        hovered && !disabled ? hoverStyle : null,
        pressed && !disabled ? styles.pressed : null,
        { cursor: disabled ? 'auto' : 'pointer' },
        disabled ? styles.disabled : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

/* --------------------------------------------------------------------- Button */

export type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'outline' | 'danger';

interface ButtonPalette {
  bg: string;
  fg: string;
  border: string;
  hover: string;
  hoverBorder: string;
}

const BUTTON_PALETTE: Record<ButtonVariant, ButtonPalette> = {
  primary: {
    bg: colors.primary,
    fg: colors.white,
    border: colors.primary,
    hover: colors.primaryDark,
    hoverBorder: colors.primaryDark,
  },
  accent: {
    bg: colors.accent,
    fg: colors.white,
    border: colors.accent,
    hover: '#7C3AED',
    hoverBorder: '#7C3AED',
  },
  ghost: {
    bg: 'transparent',
    fg: colors.primary,
    border: 'transparent',
    hover: colors.primarySoft,
    hoverBorder: colors.primarySoft,
  },
  outline: {
    bg: colors.surface,
    fg: colors.text,
    border: colors.border,
    hover: colors.primarySoft,
    hoverBorder: colors.primaryBorder,
  },
  danger: {
    bg: colors.dangerSoft,
    fg: '#B91C1C',
    border: '#FECACA',
    hover: '#FEE2E2',
    hoverBorder: '#FCA5A5',
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  small = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const palette = BUTTON_PALETTE[variant];
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[
        styles.button,
        small ? styles.buttonSmall : null,
        { backgroundColor: palette.bg, borderColor: palette.border },
        style,
      ]}
      hoverStyle={{ backgroundColor: palette.hover, borderColor: palette.hoverBorder }}
    >
      <Text style={[styles.buttonLabel, small ? styles.buttonLabelSmall : null, { color: palette.fg }]}>
        {label}
      </Text>
    </Touchable>
  );
}

/* ---------------------------------------------------------------------- Badge */

export function Badge({
  label,
  tone,
  style,
}: {
  label: string;
  tone: ToneColors;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }, style]}>
      <Text style={[styles.badgeLabel, { color: tone.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------------------- ProgressBar */

export function ProgressBar({
  percent,
  color = colors.primary,
  height = 8,
}: {
  percent: number;
  color?: string;
  height?: number;
}): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height / 2 }]}>
      <View
        style={[styles.progressFill, { width: `${clamped}%`, backgroundColor: color, borderRadius: height / 2 }]}
      />
    </View>
  );
}

/* --------------------------------------------------------------------- Avatar */

export function Avatar({ member, size = 28 }: { member: Member | null; size?: number }): React.ReactElement {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: member ? member.color : colors.slateSoft,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4, color: member ? colors.white : colors.textMuted }]}>
        {member ? member.initials : '—'}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------------------------- Card */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }): React.ReactElement {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

/* ----------------------------------------------------------------- EmptyState */

export function EmptyState({
  emoji,
  title,
  message,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.ReactElement {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.emptyAction} />
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------------------- Fields */

export function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  invalid = false,
  onSubmitEditing,
  secureTextEntry = false,
  autoCapitalize,
  keyboardType,
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  invalid?: boolean;
  onSubmitEditing?: () => void;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: KeyboardTypeOptions;
  style?: StyleProp<TextStyle>;
}): React.ReactElement {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      multiline={multiline}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      onSubmitEditing={onSubmitEditing}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.input,
        multiline ? styles.inputMultiline : null,
        focused ? styles.inputFocused : null,
        invalid ? styles.inputInvalid : null,
        style,
      ]}
    />
  );
}

/* ------------------------------------------------------------------ ChipGroup */

interface ChipOption<T extends string> {
  value: T;
  label: string;
  tone?: ToneColors;
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  return (
    <View style={[styles.chipRow, style]}>
      {options.map(option => {
        const selected = option.value === value;
        const tone = option.tone;
        return (
          <Touchable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityLabel={option.label}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: tone ? tone.bg : colors.primary, borderColor: tone ? tone.fg : colors.primary }
                : styles.chipIdle,
            ]}
            hoverStyle={selected ? null : styles.chipHover}
          >
            <Text
              style={[
                styles.chipLabel,
                selected ? { color: tone ? tone.fg : colors.white, fontWeight: '700' } : styles.chipLabelIdle,
              ]}
            >
              {option.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

/* ----------------------------------------------------------------- SheetModal */

export function SheetModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, wide ? styles.sheetWide : null]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <Touchable
              onPress={onClose}
              accessibilityLabel="Close"
              style={styles.closeButton}
              hoverStyle={styles.closeButtonHover}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Touchable>
          </View>
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/* --------------------------------------------------------------- ConfirmDialog */

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Cancel" />
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmMessage}>{message}</Text>
          <View style={styles.confirmActions}>
            <Button label="Cancel" variant="outline" onPress={onCancel} />
            <Button label={confirmLabel} variant="danger" onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ----------------------------------------------------------------- PageHeader */

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderText}>
        <Text style={styles.pageEyebrow}>{eyebrow}</Text>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.pageSubtitle}>{subtitle}</Text>
      </View>
      {right ? <View style={styles.pageHeaderRight}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm },
  buttonLabel: { fontSize: 14, fontWeight: '700' },
  buttonLabelSmall: { fontSize: 12.5 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  progressTrack: { width: '100%', backgroundColor: '#E9EAF3', overflow: 'hidden' },
  progressFill: { height: '100%' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4, textAlign: 'center' },
  emptyMessage: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', maxWidth: 420, lineHeight: 20 },
  emptyAction: { marginTop: spacing.lg },
  field: { marginBottom: spacing.lg },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldHint: { fontSize: 11.5, color: colors.textFaint, marginTop: 5 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  inputFocused: { borderColor: colors.primary },
  inputInvalid: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  chipHover: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  chipLabel: { fontSize: 12.5, fontWeight: '600' },
  chipLabelIdle: { color: colors.textMuted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.raised,
  },
  sheetWide: { maxWidth: 760 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    gap: spacing.md,
  },
  sheetHeaderText: { flex: 1 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sheetSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeButtonHover: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  closeButtonText: { fontSize: 14, color: colors.textMuted, fontWeight: '700' },
  sheetBody: { flexGrow: 0 },
  sheetBodyContent: { padding: spacing.xl },
  sheetFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    flexWrap: 'wrap',
  },
  confirmBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.raised,
  },
  confirmTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 6 },
  confirmMessage: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.xl },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
    flexWrap: 'wrap',
    marginBottom: spacing.xl,
  },
  pageHeaderText: { flexShrink: 1, minWidth: 220 },
  pageHeaderRight: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  pageEyebrow: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  pageTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
});
