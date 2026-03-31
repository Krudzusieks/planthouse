// login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(''); // email OR username.code
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Real email = has @ AND domain part contains a dot (gmail.com, yahoo.com etc)
  const isRealEmail = (val: string) => {
    const atIdx = val.indexOf('@');
    if (atIdx <= 0) return false;
    const domain = val.slice(atIdx + 1);
    return domain.includes('.');
  };

  const handleLogin = async () => {
    const val = identifier.trim().toLowerCase();
    if (!val || !password)
      return Alert.alert('Required', 'Please enter your login and password.');

    setLoading(true);
    try {
      let emailToUse = val;

      // ─── CASE 1: REAL EMAIL ─────────────────────────────
      if (isRealEmail(val)) {
        // Try find worker by profile email (now works because username is stored)
        const { data: profileByEmail } = await supabase
          .from('profiles')
          .select('id, company_id, username, role')
          .eq('email', val)
          .maybeSingle();

        if (profileByEmail && profileByEmail.username) {
          // It's a worker who has set their real email
          const { data: company } = await supabase
            .from('companies')
            .select('code')
            .eq('id', profileByEmail.company_id)
            .single();

          if (!company)
            throw new Error('Workspace not found for this user.');

          emailToUse = `${profileByEmail.username}@${company.code}.planthouse`;
        } else {
          // Boss or user without username → use real email directly
          emailToUse = val;
        }
      }
      // ─── CASE 2: USERNAME.CODE ─────────────────────────
      else {
        const dotIndex = val.lastIndexOf('.');
        if (dotIndex <= 0)
          throw new Error(
            'Enter your login as username.code\ne.g. tom.rgh\n\nBoss? Use your email address.'
          );

        const username = val.slice(0, dotIndex);
        const code = val.slice(dotIndex + 1);

        if (!username || !code)
          throw new Error('Enter your login as username.code\ne.g. tom.rgh');

        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('code')
          .eq('code', code)
          .maybeSingle();

        if (companyError || !company)
          throw new Error(
            `No workspace found with code "${code}".\n\nCheck the code with your boss.`
          );

        // Use company.code (not slug) for consistency
        emailToUse = `${username}@${company.code}.planthouse`;
      }

      // ─── FINAL SIGN IN ─────────────────────────────────
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (error) throw new Error('Incorrect login or password.');
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const val = identifier.trim().toLowerCase();
    if (!val || !isRealEmail(val)) {
      return Alert.alert(
        'Email Required',
        'Enter your email address in the login field above, then tap "Forgot password".\n\nIf you are a worker without an email set, ask your boss to reset your password.'
      );
    }

    setForgotLoading(true);

    // Check if this is a worker's real email
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('email', val)
      .maybeSingle();

    if (profile && profile.role !== 'boss') {
      setForgotLoading(false);
      return Alert.alert(
        'Worker Account',
        'Workers cannot reset their own password yet.\n\nPlease ask your boss to reset it from the Workers screen.'
      );
    }

    // Boss → normal Supabase reset
    const { error } = await supabase.auth.resetPasswordForEmail(val, {
      redirectTo: 'planthouse://reset-password',
    });

    setForgotLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        'Email Sent',
        `Password reset instructions have been sent to ${val}.\n\nCheck your inbox.`
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.headerArea}>
              <Text style={styles.emoji}>🌱</Text>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to manage your workspace</Text>
            </View>

            <View style={styles.form}>
              {/* Identifier field */}
              <View style={styles.field}>
                <Text style={styles.label}>Email or Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="kaspars@gmail.com or tom.rgh"
                  placeholderTextColor="#3D5C3A"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                />
                <Text style={styles.hint}>
                  {isRealEmail(identifier)
                    ? 'Logging in with email'
                    : identifier.includes('.')
                    ? 'Logging in as worker'
                    : 'Boss: use email · Worker: use username.code'}
                </Text>
              </View>

              {/* Password field */}
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="Your password"
                    placeholderTextColor="#3D5C3A"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeBtn}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#3D5C3A" strokeWidth={2} />
                    ) : (
                      <Eye size={18} color="#3D5C3A" strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sign in button */}
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Forgot password */}
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={handleForgotPassword}
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <ActivityIndicator color="#4CAF50" size="small" />
                ) : (
                  <Text style={styles.forgotText}>Forgot password?</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Info boxes */}
            
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.replace('/register')}
            >
              <Text style={styles.secondaryBtnText}>Create a New Workspace</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1A12' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.12 },
  blob1: { width: 300, height: 300, backgroundColor: '#5BA85F', top: -80, right: -100 },
  blob2: { width: 200, height: 200, backgroundColor: '#3D8B37', bottom: 80, left: -60 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 40 },
  backBtn: { marginBottom: 32 },
  backText: { color: '#7FAE7A', fontSize: 16 },
  headerArea: { marginBottom: 40 },
  emoji: { fontSize: 44, marginBottom: 14 },
  title: { fontSize: 32, fontWeight: '800', color: '#E8F5E0', letterSpacing: -1.2, marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#7FAE7A' },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { color: '#7FAE7A', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  hint: { color: '#3D5C3A', fontSize: 12, marginTop: 2 },
  input: {
    backgroundColor: '#162018',
    borderWidth: 1.5,
    borderColor: '#243524',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#E8F5E0',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162018',
    borderWidth: 1.5,
    borderColor: '#243524',
    borderRadius: 12,
  },
  inputFlex: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#E8F5E0',
    fontSize: 16,
  },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  primaryBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  forgotBtn: { alignItems: 'center', paddingVertical: 8 },
  forgotText: { color: '#4CAF50', fontSize: 14 },
  infoSection: { flexDirection: 'row', gap: 12, marginTop: 8 },
  infoBox: {
    flex: 1,
    backgroundColor: '#162018',
    borderWidth: 1,
    borderColor: '#243524',
    borderRadius: 12,
    padding: 14,
  },
  infoTitle: { color: '#7FAE7A', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  infoText: { color: '#3D5C3A', fontSize: 12, lineHeight: 18 },
  infoCode: { color: '#4CAF50', fontFamily: 'Courier', fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1E2E1E' },
  dividerText: { color: '#3D5C3A', fontSize: 13 },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(93,168,95,0.4)',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#7FAE7A', fontSize: 16, fontWeight: '600' },
});