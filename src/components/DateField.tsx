import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { addDaysISO, addMonthsISO, isValidISODate, todayISO } from '../dates';
import { colors, radius, spacing } from '../theme';
import { TextField, Touchable } from './ui';

interface Preset {
  label: string;
  compute: () => string;
}

const PRESETS: Preset[] = [
  { label: 'Today', compute: () => todayISO() },
  { label: '+1 week', compute: () => addDaysISO(todayISO(), 7) },
  { label: '+1 month', compute: () => addMonthsISO(todayISO(), 1) },
  { label: '+3 months', compute: () => addMonthsISO(todayISO(), 3) },
];

export function DateField({
  value,
  onChange,
  allowClear = true,
}: {
  value: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
}): React.ReactElement {
  const valid = value.length === 0 || isValidISODate(value);
  return (
    <View>
      <TextField value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" invalid={!valid} />
      <View style={styles.presetRow}>
        {PRESETS.map(preset => (
          <Touchable
            key={preset.label}
            accessibilityLabel={preset.label}
            onPress={() => onChange(preset.compute())}
            style={styles.preset}
            hoverStyle={styles.presetHover}
          >
            <Text style={styles.presetText}>{preset.label}</Text>
          </Touchable>
        ))}
        {allowClear && value.length > 0 ? (
          <Touchable
            accessibilityLabel="Clear date"
            onPress={() => onChange('')}
            style={styles.preset}
            hoverStyle={styles.presetHover}
          >
            <Text style={styles.presetText}>Clear</Text>
          </Touchable>
        ) : null}
      </View>
      {!valid ? <Text style={styles.error}>Enter a real date as YYYY-MM-DD, e.g. 2026-03-14.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  preset: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetHover: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  presetText: { fontSize: 11.5, color: colors.textMuted, fontWeight: '700' },
  error: { fontSize: 11.5, color: colors.danger, marginTop: spacing.xs, fontWeight: '600' },
});
