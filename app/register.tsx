import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

// Slug: lowercase, strip everything except a-z 0-9
const toSlug     = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Username: lowercase, strip spaces
const toUsername = (s: string) => s.toLowerCase().replace(/\s+/g, '');
// Internal Supabase email — never shown to user
const fakeEmail  = (username: string, slug: string) => `${username}@${slug}.planthouse`;

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep]   = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  const [companyName, setCompanyName]         = useState('');
  const [fullName, setFullName]               = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const slug     = toSlug(companyName);
  const username = toUsername(fullName);

  const handleNext = () => {
    if (!companyName.trim()) return Alert.alert('Required', 'Enter your company name.');
    if (slug.length < 2)    return Alert.alert('Invalid Name', 'Company name must produce a valid ID (at least 2 letters/numbers).');
    setStep(2);
  };

  const handleRegister = async () => {
    if (!fullName.trim() || !password || !confirmPassword)
      return Alert.alert('Required', 'Please fill in all fields.');
    if (username.length < 2)
      return Alert.alert('Invalid Name', 'Your name must contain at least 2 characters.');
    if (password !== confirmPassword)
      return Alert.alert('Password Mismatch', 'Passwords do not match.');
    if (password.length < 6)
      return Alert.alert('Weak Password', 'Password must be at least 6 characters.');

    setLoading(true);
    try {
      // Check slug availability
      const { data: existing } = await supabase
        .from('companies').select('id').eq('slug', slug).maybeSingle();
      if (existing) throw new Error(`Company ID "${slug}" is already taken. Try a different company name.`);

      const email = fakeEmail(username, slug);

      // Sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned from signup');

      // Sign out immediately so session doesn't fire yet
      await supabase.auth.signOut();

      // Create company + boss profile
      const { error: rpcError } = await supabase.rpc('register_company_and_boss', {
        company_name:   companyName.trim(),
        company_slug:   slug,
        user_id:        authData.user.id,
        user_full_name: fullName.trim(),
      });
      if (rpcError) throw rpcError;

      // Sign in — _layout.tsx will detect session and go to /home
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
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

            <TouchableOpacity style={styles.backBtn} onPress={() => step === 2 ? setStep(1) : router.replace('/')}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.headerArea}>
              <Text style={styles.emoji}>{step === 1 ? '🏢' : '👤'}</Text>
              <Text style={styles.title}>{step === 1 ? 'Register Company' : 'Create Boss Account'}</Text>
              <Text style={styles.subtitle}>
                {step === 1 ? 'Set up your garden center in PlantHouse' : "You'll have full control over the system"}
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
                  <Text style={styles.label}>Company Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Garden House"
                    placeholderTextColor="#3D5C3A"
                    value={companyName}
                    onChangeText={setCompanyName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={handleNext}
                  />
                </View>
                {slug.length > 0 && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>Company login ID</Text>
                    <Text style={styles.previewValue}>@{slug}</Text>
                    <Text style={styles.previewHint}>Workers will log in as username@{slug}</Text>
                  </View>
                )}
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
                    placeholder="e.g. John"
                    placeholderTextColor="#3D5C3A"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                {username.length > 0 && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>Your login handle</Text>
                    <Text style={styles.previewValue}>{username}@{slug}</Text>
                  </View>
                )}
                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Min. 6 characters"
                    placeholderTextColor="#3D5C3A"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Repeat password"
                    placeholderTextColor="#3D5C3A"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleRegister} disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Register Company 🌱</Text>}
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
  input: { backgroundColor: '#162018', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, color: '#E8F5E0', fontSize: 16 },
  previewBox: { backgroundColor: '#0E1A12', borderWidth: 1, borderColor: '#243524', borderRadius: 12, padding: 14, marginTop: -8 },
  previewLabel: { color: '#3D5C3A', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  previewValue: { color: '#4CAF50', fontSize: 18, fontWeight: '800', fontFamily: 'Courier' },
  previewHint: { color: '#3D5C3A', fontSize: 11, marginTop: 4 },
  primaryBtn: { backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 8, shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  loginLink: { alignItems: 'center', marginTop: 28 },
  loginLinkText: { color: '#4CAF50', fontSize: 15 },
});