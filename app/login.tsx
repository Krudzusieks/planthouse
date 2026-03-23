import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [handle, setHandle]     = useState(''); // "john@gardenhouse"
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    const trimmed = handle.trim().toLowerCase();
    if (!trimmed || !password)
      return Alert.alert('Required', 'Please enter your login and password.');

    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex <= 0)
      return Alert.alert('Invalid Format', 'Enter your login as username@company\ne.g. john@gardenhouse');

    const username    = trimmed.slice(0, atIndex);
    const companySlug = trimmed.slice(atIndex + 1);

    if (!username || !companySlug)
      return Alert.alert('Invalid Format', 'Enter your login as username@company\ne.g. john@gardenhouse');

    const fakeEmail = `${username}@${companySlug}.planthouse`;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
    setLoading(false);

    if (error) Alert.alert('Sign In Failed', 'Incorrect login or password.');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.headerArea}>
              <Text style={styles.emoji}>🌱</Text>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to manage your greenhouse</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Login</Text>
                <TextInput
                  style={styles.input}
                  placeholder="username@company"
                  placeholderTextColor="#3D5C3A"
                  value={handle}
                  onChangeText={setHandle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                />
                <Text style={styles.inputHint}>e.g. john@gardenhouse</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your password"
                  placeholderTextColor="#3D5C3A"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleLogin} disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/register')}>
              <Text style={styles.secondaryBtnText}>Register a New Company</Text>
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
  input: { backgroundColor: '#162018', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, color: '#E8F5E0', fontSize: 16 },
  inputHint: { color: '#3D5C3A', fontSize: 12, marginTop: 2 },
  primaryBtn: { backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 8, shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1E2E1E' },
  dividerText: { color: '#3D5C3A', fontSize: 13 },
  secondaryBtn: { borderWidth: 1.5, borderColor: 'rgba(93,168,95,0.4)', borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  secondaryBtnText: { color: '#7FAE7A', fontSize: 16, fontWeight: '600' },
});