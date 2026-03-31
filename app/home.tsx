import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Modal, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ScanLine, Layers, Leaf, ClipboardList, Users, MapPin,
  Crown, HardHat, LogOut, Lock, Eye, EyeOff, CheckCircle, Circle,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'boss' | 'manager' | 'worker';

interface Module {
  id: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  route: string;
  color: string;
  enabled: boolean;
  roles: Role[];
}

// ─── Module definitions (icons instead of emojis) ─────────────────────────────

const MODULES: Module[] = [
  { id: 'scanner',   label: 'Scanner',       icon: ScanLine,       route: '/scanner',       color: '#4CAF50', enabled: true, roles: ['boss', 'manager', 'worker'] },
  { id: 'batches',   label: 'Plant Batches', icon: Layers,         route: '/plant-batches', color: '#66BB6A', enabled: true, roles: ['boss', 'manager', 'worker'] },
  { id: 'plants',    label: 'Plants',        icon: Leaf,           route: '/plants',         color: '#81C784', enabled: true, roles: ['boss', 'manager'] },
  { id: 'jobs',      label: 'Jobs',          icon: ClipboardList,  route: '/jobs',           color: '#AB47BC', enabled: true, roles: ['boss', 'manager', 'worker'] },
  { id: 'workers',   label: 'Workers',       icon: Users,          route: '/workers',        color: '#FFA726', enabled: true, roles: ['boss'] },
  { id: 'locations', label: 'Locations',     icon: MapPin,         route: '/locations',      color: '#29B6F6', enabled: true, roles: ['boss'] },
];

// ─── Role icon helper ─────────────────────────────────────────────────────────

function RoleIcon({ role, size, color }: { role: Role; size: number; color: string }) {
  if (role === 'boss')    return <Crown    size={size} color={color} strokeWidth={2} />;
  if (role === 'manager') return <ClipboardList size={size} color={color} strokeWidth={2} />;
  return <HardHat size={size} color={color} strokeWidth={2} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { profile, company } = useAuth();

  const role: Role = (profile?.role as Role) ?? 'worker';

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword]             = useState('');
  const [confirmPassword, setConfirmPassword]     = useState('');
  const [changingPassword, setChangingPassword]   = useState(false);
  const [showNew, setShowNew]                     = useState(false);
  const [showConfirm, setShowConfirm]             = useState(false);
  const [firstLoginEmail, setFirstLoginEmail]     = useState('');

  useEffect(() => {
    if (profile?.must_change_password) setShowPasswordModal(true);
  }, [profile?.must_change_password]);

const handleChangePassword = async () => {
  if (!newPassword.trim())
    return Alert.alert('Required', 'Enter your new password.');
  if (newPassword.length < 6)
    return Alert.alert('Too short', 'Password must be at least 6 characters.');
  if (newPassword !== confirmPassword)
    return Alert.alert('Mismatch', 'Passwords do not match.');

  setChangingPassword(true);

  // ✅ ONLY change password in auth
  const { error: authError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (authError) {
    setChangingPassword(false);
    return Alert.alert('Error', authError.message);
  }

  // ✅ Save email in profile ONLY (NOT auth)
  await supabase.from('profiles').update({
    email: firstLoginEmail.trim().toLowerCase() || null,
    must_change_password: false,
  }).eq('id', profile?.id);

  setChangingPassword(false);
  setShowPasswordModal(false);
  setNewPassword('');
  setConfirmPassword('');
  setFirstLoginEmail('');

  Alert.alert('Done', 'Your account is ready.');
};

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const visibleModules = MODULES.filter(m => m.roles.includes(role));

  // Role badge colours
  const roleMeta = {
    boss:    { label: 'Boss',    bg: 'rgba(255,193,7,0.15)',   border: 'rgba(255,193,7,0.4)',   iconColor: '#FFC107' },
    manager: { label: 'Manager', bg: 'rgba(255,167,38,0.15)',  border: 'rgba(255,167,38,0.4)',  iconColor: '#FFA726' },
    worker:  { label: 'Worker',  bg: 'rgba(127,174,122,0.15)', border: 'rgba(127,174,122,0.4)', iconColor: '#7FAE7A' },
  }[role];

  const passwordValid   = newPassword.length >= 6;
  const passwordsMatch  = newPassword === confirmPassword && confirmPassword.length > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>
                {getGreeting()}, {profile?.full_name?.split(' ')[0] ?? 'there'}
              </Text>
              <Text style={styles.companyName}>
                {company?.name ?? ''}
                {company?.code ? <Text style={styles.companyCode}>  ({company.code})</Text> : null}
              </Text>
            </View>
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <LogOut size={14} color="#7FAE7A" strokeWidth={2.5} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          {/* ── Role badge — boss and manager only ── */}
          {role !== 'worker' && (
            <View style={styles.roleBadgeRow}>
              <View style={[styles.roleBadge, { backgroundColor: roleMeta.bg, borderColor: roleMeta.border }]}>
                <RoleIcon role={role} size={13} color={roleMeta.iconColor} />
                <Text style={styles.roleBadgeText}>{roleMeta.label}</Text>
              </View>
            </View>
          )}

          {/* ── Module grid ── */}
          <View style={styles.grid}>
            {visibleModules.map((mod) => {
              const IconComponent = mod.icon;
              return (
                <TouchableOpacity
                  key={mod.id}
                  style={[
                    styles.moduleCard,
                    !mod.enabled && styles.moduleDisabled,
                    { borderColor: mod.enabled ? mod.color + '44' : '#1E2E1E' },
                  ]}
                  onPress={() => {
                    if (!mod.enabled) { Alert.alert('Coming Soon', `${mod.label} will be available soon.`); return; }
                    router.push(mod.route as any);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.moduleIconBox, { backgroundColor: mod.enabled ? mod.color + '22' : '#1A2A1A' }]}>
                    <IconComponent
                      size={26}
                      color={mod.enabled ? mod.color : '#3D5C3A'}
                      strokeWidth={1.75}
                    />
                  </View>
                  <Text style={[styles.moduleLabel, !mod.enabled && styles.moduleLabelDisabled]}>
                    {mod.label}
                  </Text>
                  {!mod.enabled && <Text style={styles.soonBadge}>SOON</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* ── Set Password Modal ── */}
      <Modal visible={showPasswordModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.pwModalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={styles.pwModalBox}>

              {/* Lock icon */}
              <View style={styles.pwLockIcon}>
                <View style={styles.pwLockCircle}>
                  <Lock size={28} color="#4CAF50" strokeWidth={2} />
                </View>
              </View>

              <Text style={styles.pwModalTitle}>Set Your Password</Text>
              <Text style={styles.pwModalSubtitle}>
                Your account was created with a temporary password.{'\n'}Please set a new private password now.
              </Text>

              {/* Optional email for workers */}
              {role === 'worker' && (
                <>
                  <Text style={styles.pwLabel}>YOUR EMAIL (optional)</Text>
                  <TextInput
                    style={styles.pwEmailInput}
                    placeholder="your@email.com"
                    placeholderTextColor="#3D5C3A"
                    value={firstLoginEmail}
                    onChangeText={setFirstLoginEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                  <Text style={styles.pwEmailHint}>
                    If you add your email you can log in with it and reset your own password in the future.
                  </Text>
                </>
              )}

              {/* New password */}
              <Text style={styles.pwLabel}>NEW PASSWORD</Text>
              <View style={styles.pwInputRow}>
                <TextInput
                  style={styles.pwInput}
                  placeholder="Enter new password"
                  placeholderTextColor="#3D5C3A"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                  {showNew
                    ? <EyeOff size={18} color="#3D5C3A" strokeWidth={2} />
                    : <Eye    size={18} color="#3D5C3A" strokeWidth={2} />
                  }
                </TouchableOpacity>
              </View>

              {/* Confirm password */}
              <Text style={styles.pwLabel}>CONFIRM PASSWORD</Text>
              <View style={styles.pwInputRow}>
                <TextInput
                  style={styles.pwInput}
                  placeholder="Repeat new password"
                  placeholderTextColor="#3D5C3A"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                  {showConfirm
                    ? <EyeOff size={18} color="#3D5C3A" strokeWidth={2} />
                    : <Eye    size={18} color="#3D5C3A" strokeWidth={2} />
                  }
                </TouchableOpacity>
              </View>

              {/* Hints */}
              <View style={styles.pwHints}>
                <View style={styles.pwHintRow}>
                  {passwordValid
                    ? <CheckCircle size={14} color="#4CAF50" strokeWidth={2.5} />
                    : <Circle      size={14} color="#3D5C3A" strokeWidth={2} />
                  }
                  <Text style={[styles.pwHint, passwordValid && styles.pwHintOk]}>
                    At least 6 characters
                  </Text>
                </View>
                <View style={styles.pwHintRow}>
                  {passwordsMatch
                    ? <CheckCircle size={14} color="#4CAF50" strokeWidth={2.5} />
                    : <Circle      size={14} color="#3D5C3A" strokeWidth={2} />
                  }
                  <Text style={[styles.pwHint, passwordsMatch && styles.pwHintOk]}>
                    Passwords match
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.pwConfirmBtn, (changingPassword || !passwordValid || !passwordsMatch) && styles.pwConfirmDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword || !passwordValid || !passwordsMatch}
              >
                {changingPassword
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.pwConfirmText}>Set Password & Continue</Text>
                }
              </TouchableOpacity>

              <View style={styles.pwFooter}>
                <Lock size={12} color="#3D5C3A" strokeWidth={2} />
                <Text style={styles.pwFooter}>Your boss will not know your new password</Text>
              </View>

            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1A12' },
  blob:  { position: 'absolute', borderRadius: 999, opacity: 0.08 },
  blob1: { width: 400, height: 400, backgroundColor: '#3D8B37', top: -150, right: -150 },
  blob2: { width: 300, height: 300, backgroundColor: '#2D6A27', bottom: -100, left: -100 },
  scroll: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8,
  },
  greeting:    { color: '#E8F5E0', fontSize: 22, fontWeight: '800', marginBottom: 2 },
  companyName: { color: '#7FAE7A', fontSize: 14, fontWeight: '500' },
  companyCode: { color: '#3D5C3A', fontSize: 13, fontWeight: '400' },
  signOutBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#243524', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7, marginTop: 4,
  },
  signOutText: { color: '#7FAE7A', fontSize: 13, fontWeight: '600' },

  // Role badge
  roleBadgeRow: { paddingHorizontal: 24, marginBottom: 24 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  roleBadgeText: { color: '#E8F5E0', fontSize: 13, fontWeight: '700' },

  // Module grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 },
  moduleCard: {
    width: '47%', backgroundColor: '#162018', borderRadius: 20,
    borderWidth: 1.5, padding: 20, alignItems: 'center', gap: 10,
  },
  moduleDisabled: { opacity: 0.4 },
  moduleIconBox:  {
    width: 60, height: 60, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  moduleLabel:         { color: '#E8F5E0', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  moduleLabelDisabled: { color: '#7FAE7A' },
  soonBadge:           { color: '#3D5C3A', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: -4 },

  // Password modal
  pwModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  pwModalBox: {
    backgroundColor: '#162018', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 28, paddingBottom: 48,
  },
  pwLockIcon:   { alignItems: 'center', marginBottom: 20 },
  pwLockCircle: { width: 60, height: 60, backgroundColor: '#4CAF50', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pwModalTitle: { color: '#E8F5E0', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  pwModalSubtitle: {
    color: '#A8BDA6', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 30,
  },

  pwLabel:        { color: '#A8BDA6', fontSize: 13, fontWeight: '500' },
  pwEmailInput:   {
    backgroundColor: '#1C2B1F', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
    marginTop: 6, marginBottom: 12, fontSize: 16, color: '#E8F5E0', borderWidth: 1.5, borderColor: '#3D5C3A',
  },
  pwEmailHint:    { color: '#A8BDA6', fontSize: 12, fontWeight: '500', textAlign: 'center', marginTop: 10 },
  pwInputRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  pwInput:        { flex: 1, backgroundColor: '#1C2B1F', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, color: '#E8F5E0', fontSize: 16 },
  eyeBtn:         { paddingLeft: 12 },
  pwHints:         { marginTop: 20 },
  pwHintRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  pwHint:         { fontSize: 12, color: '#A8BDA6', fontWeight: '500' },
  pwHintOk:       { color: '#4CAF50', fontWeight: '600' },

  pwConfirmBtn:   {
    backgroundColor: '#4CAF50', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  pwConfirmDisabled: { opacity: 0.5 },
  pwConfirmText:   { color: '#E8F5E0', fontSize: 16, fontWeight: '600' },
  pwFooter:        { flexDirection: 'row', alignItems: 'center', marginTop: 28 },
  pwFooterText:    { fontSize: 12, color: '#A8BDA6' },
});
