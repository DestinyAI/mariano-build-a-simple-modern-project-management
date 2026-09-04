import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { Button, Card, Field, TextField } from './ui';
import { colors, radius, spacing } from '../theme';

export default function LoginScreen(): React.ReactElement {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !submitting;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    if (submitting) return;
    setSubmitting(true);
    const ok = await signIn(username.trim(), password);
    if (ok) return; // The auth gate swaps this screen out on success.
    setError(true);
    setPassword('');
    setSubmitting(false);
  };

  const clearError = (): void => {
    if (error) setError(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.inner}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>TF</Text>
          </View>
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>TeamFlow</Text>
            <Text style={styles.brandTag}>Project workspace</Text>
          </View>
        </View>

        <Card style={styles.card}>
          <Text style={styles.title}>Iniciá sesión</Text>
          <Text style={styles.subtitle}>
            Ingresá con tu usuario para entrar al workspace del equipo.
          </Text>

          <Field label="Usuario">
            <TextField
              value={username}
              onChangeText={value => {
                setUsername(value);
                clearError();
              }}
              placeholder="Juan"
              autoCapitalize="none"
              invalid={error}
              onSubmitEditing={() => void submit()}
            />
          </Field>

          <Field label="Contraseña">
            <TextField
              value={password}
              onChangeText={value => {
                setPassword(value);
                clearError();
              }}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              invalid={error}
              onSubmitEditing={() => void submit()}
            />
          </Field>

          {error ? (
            <Text style={styles.error}>Usuario o contraseña incorrectos.</Text>
          ) : null}

          <Button
            label={submitting ? 'Ingresando…' : 'Ingresar'}
            onPress={() => void submit()}
            disabled={!canSubmit}
            style={styles.submit}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  inner: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
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
  card: { width: '100%' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.xl,
    lineHeight: 19,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  submit: { marginTop: spacing.sm },
});
