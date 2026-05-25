// register.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff } from 'lucide-react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — Workspace
  const [workspaceName, setWorkspaceName] = useState('');

  // Step 2 — Boss account
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleNext = () => {
    if (!workspaceName.trim())
      return Alert.alert('Required', 'Enter your workspace name.');
    setStep(2);
  };

  const handleRegister = async () => {
    if (!fullName.trim())
      return Alert.alert('Required', 'Enter your name.');
    if (!email.trim() || !email.includes('@'))
      return Alert.alert('Required', 'Enter a valid email address.');
    if (!password)
      return Alert.alert('Required', 'Enter a password.');
    if (password.length < 6)
      return Alert.alert('Too short', 'Password must be at least 6 characters.');
    if (password !== confirmPassword)
      return Alert.alert('Mismatch', 'Passwords do not match.');

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned from signup.');

      await supabase.auth.signOut();

      const { error: rpcError } = await supabase.rpc('register_company_and_boss', {
        company_name:   workspaceName.trim(),
        user_id:        authData.user.id,
        user_full_name: fullName.trim(),
        user_email:     email.trim().toLowerCase(),
      });
      if (rpcError) throw rpcError;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;

    } catch (err: any) {
      await supabase.auth.signOut();
      Alert.alert('Registration Failed', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            <TouchableOpacity style={styles.backBtn}
              onPress={() => step === 2 ? setStep(1) : router.replace('/')}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.headerArea}>
              <Text style={styles.emoji}>{step === 1 ? '🏡' : '👤'}</Text>
              <Text style={styles.title}>
                {step === 1 ? 'Create Workspace' : 'Your Account'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 1
                  ? 'Set up your garden or business in PlantHouse'
                  : 'This will be your boss account with full access'}
              </Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepDot, styles.stepDotActive]}>
                <Text style={[styles.stepNum, styles.stepNumActive]}>1</Text>
              </View>
              <View style={[styles.stepLine, step === 2 && styles.stepLineActive]} />
              <View style={[styles.stepDot, step === 2 && styles.stepDotActive]}>
                <Text style={[styles.stepNum, step === 2 && styles.stepNumActive]}>2</Text>
              </View>
            </View>

            {step === 1 && (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>Workspace Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Riga Garden House"
                    placeholderTextColor="#3D5C3A"
                    value={workspaceName}
                    onChangeText={setWorkspaceName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={handleNext}
                  />
                  <Text style={styles.hint}>The display name shown across the app</Text>
                </View>

                <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
                  <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>Your Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Kaspars"
                    placeholderTextColor="#3D5C3A"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="kaspars@gmail.com"
                    placeholderTextColor="#3D5C3A"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                  <Text style={styles.hint}>Used to log in and reset your password</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.inputFlex}
                      placeholder="Min. 6 characters"
                      placeholderTextColor="#3D5C3A"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      returnKeyType="next"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                      {showPassword
                        ? <EyeOff size={18} color="#3D5C3A" strokeWidth={2} />
                        : <Eye size={18} color="#3D5C3A" strokeWidth={2} />}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.inputFlex}
                      placeholder="Repeat password"
                      placeholderTextColor="#3D5C3A"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirm}
                      returnKeyType="done"
                      onSubmitEditing={handleRegister}
                    />
                    <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                      {showConfirm
                        ? <EyeOff size={18} color="#3D5C3A" strokeWidth={2} />
                        : <Eye size={18} color="#3D5C3A" strokeWidth={2} />}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.primaryBtnText}>Create Workspace 🌱</Text>}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity onPress={() => router.replace('/login')} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>Already have an account? Sign in</Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1A12' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.1 },
  blob1: { width: 280, height: 280, backgroundColor: '#3D8B37', top: -60, left: -80 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 40 },
  backBtn: { marginBottom: 24 },
  backText: { color: '#7FAE7A', fontSize: 16 },
  headerArea: { marginBottom: 32 },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '800', color: '#E8F5E0', letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#7FAE7A', lineHeight: 22 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  stepDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#3D5C3A', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.15)' },
  stepNum: { color: '#3D5C3A', fontWeight: '700', fontSize: 14 },
  stepNumActive: { color: '#4CAF50' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#1E2E1E', marginHorizontal: 8 },
  stepLineActive: { backgroundColor: '#4CAF50' },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { color: '#7FAE7A', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  hint: { color: '#3D5C3A', fontSize: 12, marginTop: 2 },
  input: {
    backgroundColor: '#162018', borderWidth: 1.5, borderColor: '#243524',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
    color: '#E8F5E0', fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#162018', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12,
  },
  inputFlex: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, color: '#E8F5E0', fontSize: 16 },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  primaryBtn: { backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 8, shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  loginLink: { alignItems: 'center', marginTop: 28 },
  loginLinkText: { color: '#4CAF50', fontSize: 15 },
});