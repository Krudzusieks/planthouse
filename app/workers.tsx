// workers.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft, Plus, HardHat, ClipboardList, Users, Phone,
  Lock, ArrowUp, ArrowDown, Trash2, UserCheck, RefreshCw, Mail,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Worker {
  id: string;
  full_name: string;
  email: string;
  role: 'worker' | 'manager';
  phone: string | null;
}

const ROLES = [
  { value: 'worker',  label: 'Worker',  icon: HardHat,      color: '#7FAE7A' },
  { value: 'manager', label: 'Manager', icon: ClipboardList, color: '#FFA726' },
] as const;

export default function WorkersScreen() {
  const router = useRouter();
  const { profile, company, lockSession, unlockSession } = useAuth();

  const [workers, setWorkers]             = useState<Worker[]>([]);
  const [loading, setLoading]             = useState(true);
  const [createVisible, setCreateVisible] = useState(false);
  const [newName, setNewName]             = useState('');
  const [newEmail, setNewEmail]           = useState('');
  const [newPhone, setNewPhone]           = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [newRole, setNewRole]             = useState<'worker' | 'manager'>('worker');
  const [creating, setCreating]           = useState(false);

  const [resetVisible, setResetVisible]     = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [resetPassword, setResetPassword]   = useState('');
  const [resetting, setResetting]           = useState(false);

  const isBoss = profile?.role === 'boss';

  const fetchWorkers = useCallback(async () => {
    if (!company?.id || !isBoss) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, phone')
      .eq('company_id', company.id)
      .in('role', ['worker', 'manager'])
      .order('full_name');

    if (error) Alert.alert('Error', error.message);
    else if (data) setWorkers(data as Worker[]);
    setLoading(false);
  }, [company?.id, isBoss]);

  useFocusEffect(useCallback(() => { fetchWorkers(); }, [fetchWorkers]));

  const resetCreateForm = () => {
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewPassword('');
    setNewRole('worker');
  };

  const handleCreate = async () => {
    if (!newName.trim())
      return Alert.alert('Required', 'Enter worker name.');
    if (!newEmail.trim() || !newEmail.includes('@'))
      return Alert.alert('Required', 'Enter a valid email address.');
    if (!newPassword.trim())
      return Alert.alert('Required', 'Enter a temporary password.');
    if (newPassword.length < 6)
      return Alert.alert('Too short', 'Password must be at least 6 characters.');

    const workerEmail = newEmail.trim().toLowerCase();

    setCreating(true);
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', workerEmail)
        .maybeSingle();
      if (existing)
        throw new Error(`An account with email "${workerEmail}" already exists.`);

      const { data: { session: bossSession } } = await supabase.auth.getSession();
      if (!bossSession) throw new Error('No active boss session.');
      const bossUserId = bossSession.user.id;

      lockSession();

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: workerEmail,
        password: newPassword.trim(),
      });
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('No user returned from signUp.');

      const newUserId = authData.user.id;

      const { error: profileError } = await supabase.from('profiles').insert({
        id:                   newUserId,
        full_name:            newName.trim(),
        email:                workerEmail,
        phone:                newPhone.trim() || null,
        role:                 newRole,
        company_id:           company?.id,
        must_change_password: true,
      });

      if (profileError) {
        await supabase.auth.setSession({
          access_token:  bossSession.access_token,
          refresh_token: bossSession.refresh_token,
        });
        unlockSession(bossUserId);
        try { await supabase.rpc('delete_auth_user', { user_id: newUserId }); } catch (_) {}
        throw profileError;
      }

      const { error: restoreError } = await supabase.auth.setSession({
        access_token:  bossSession.access_token,
        refresh_token: bossSession.refresh_token,
      });
      if (restoreError) throw restoreError;
      unlockSession(bossUserId);

      Alert.alert(
        'Worker Created ✓',
        `${newName.trim()} has been added.\n\nEmail: ${workerEmail}\nTemporary password: ${newPassword.trim()}\n\nThey will be asked to set a new password on first login.`
      );

      resetCreateForm();
      setCreateVisible(false);
      fetchWorkers();
    } catch (err: any) {
      unlockSession(profile?.id || '');
      Alert.alert('Creation Failed', err.message || 'Something went wrong.');
    } finally {
      setCreating(false);
    }
  };

  const openResetModal = (worker: Worker) => {
    setSelectedWorker(worker);
    setResetPassword('');
    setResetVisible(true);
  };

  const handleResetPassword = async () => {
    if (!selectedWorker) return;
    if (!resetPassword.trim())
      return Alert.alert('Required', 'Enter a new temporary password.');
    if (resetPassword.length < 6)
      return Alert.alert('Too short', 'Password must be at least 6 characters.');

    setResetting(true);
    try {
      const { error } = await supabase.rpc('reset_worker_password', {
        worker_id:    selectedWorker.id,
        new_password: resetPassword.trim(),
      });
      if (error) throw error;

      Alert.alert(
        'Password Reset ✓',
        `${selectedWorker.full_name} can now log in with:\n\nEmail: ${selectedWorker.email}\nNew password: ${resetPassword.trim()}`
      );

      setResetVisible(false);
      setSelectedWorker(null);
      setResetPassword('');
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Could not reset password.');
    } finally {
      setResetting(false);
    }
  };

  const handleChangeRole = (worker: Worker) => {
    const next = worker.role === 'worker' ? 'manager' : 'worker';
    Alert.alert('Change Role', `Set ${worker.full_name} as ${next}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Make ${next}`,
        onPress: async () => {
          const { error } = await supabase
            .from('profiles')
            .update({ role: next })
            .eq('id', worker.id);
          if (error) Alert.alert('Error', error.message);
          else fetchWorkers();
        },
      },
    ]);
  };

  const handleDelete = (worker: Worker) => {
    Alert.alert(
      'Delete Worker',
      `Permanently delete ${worker.full_name}?\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .delete()
              .eq('id', worker.id);
            if (error) { Alert.alert('Delete Failed', error.message); return; }
            Alert.alert('Deleted', `${worker.full_name} has been removed.`);
            fetchWorkers();
          },
        },
      ]
    );
  };

  if (!isBoss) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noAccessText}>Boss access only</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <ArrowLeft size={20} color="#7FAE7A" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Workers & Managers</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setCreateVisible(true)}>
            <Plus size={15} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {workers.length === 0 ? (
              <View style={styles.emptyState}>
                <Users size={52} color="#3D5C3A" strokeWidth={1.5} />
                <Text style={styles.emptyText}>No team members yet</Text>
                <Text style={styles.emptySubtext}>Tap "+ Add" to invite your first worker</Text>
              </View>
            ) : (
              workers.map((worker) => {
                const RoleIcon  = worker.role === 'manager' ? ClipboardList : HardHat;
                const roleColor = worker.role === 'manager' ? '#FFA726' : '#7FAE7A';
                return (
                  <View key={worker.id} style={styles.workerCard}>
                    <View style={styles.workerHeader}>
                      <View style={[
                        styles.workerIconBox,
                        { backgroundColor: roleColor + '22', borderColor: roleColor + '55' },
                      ]}>
                        <RoleIcon size={22} color={roleColor} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workerName}>{worker.full_name}</Text>
                        <Text style={styles.workerEmail}>{worker.email}</Text>
                        {worker.phone && (
                          <View style={styles.workerPhoneRow}>
                            <Phone size={11} color="#3D5C3A" strokeWidth={2} />
                            <Text style={styles.workerPhone}>{worker.phone}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.workerActions}>
                      <TouchableOpacity
                        style={[
                          styles.roleBtn,
                          worker.role === 'manager' ? styles.roleBtnManager : styles.roleBtnWorker,
                        ]}
                        onPress={() => handleChangeRole(worker)}
                      >
                        {worker.role === 'worker'
                          ? <ArrowUp   size={13} color="#4CAF50" strokeWidth={2.5} />
                          : <ArrowDown size={13} color="#FFA726" strokeWidth={2.5} />}
                        <Text style={[
                          styles.roleBtnText,
                          { color: worker.role === 'worker' ? '#4CAF50' : '#FFA726' },
                        ]}>
                          {worker.role === 'worker' ? 'Promote to Manager' : 'Demote to Worker'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.resetBtn} onPress={() => openResetModal(worker)}>
                        <RefreshCw size={14} color="#42A5F5" strokeWidth={2} />
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(worker)}>
                        <Trash2 size={14} color="#EF5350" strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* ── Add Worker Modal ── */}
      <Modal visible={createVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Add Team Member</Text>

              <Text style={styles.modalLabel}>FULL NAME *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Peter Kalnins"
                placeholderTextColor="#3D5C3A"
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
              />

              <Text style={styles.modalLabel}>EMAIL *</Text>
              <View style={styles.iconInput}>
                <Mail size={16} color="#3D5C3A" strokeWidth={2} />
                <TextInput
                  style={styles.iconInputText}
                  placeholder="peter@gmail.com"
                  placeholderTextColor="#3D5C3A"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              <Text style={styles.modalLabel}>PHONE (optional)</Text>
              <View style={styles.iconInput}>
                <Phone size={16} color="#3D5C3A" strokeWidth={2} />
                <TextInput
                  style={styles.iconInputText}
                  placeholder="+371 20000000"
                  placeholderTextColor="#3D5C3A"
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={styles.modalLabel}>TEMPORARY PASSWORD *</Text>
              <View style={styles.iconInput}>
                <Lock size={16} color="#3D5C3A" strokeWidth={2} />
                <TextInput
                  style={styles.iconInputText}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor="#3D5C3A"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={false}   
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.modalLabel}>ROLE</Text>
              <View style={styles.roleSelector}>
                {ROLES.map((r) => {
                  const IC = r.icon;
                  const active = newRole === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.roleOption, active && styles.roleOptionActive]}
                      onPress={() => setNewRole(r.value)}
                    >
                      <View style={[
                        styles.roleIconBox,
                        active && { backgroundColor: r.color + '22' },
                      ]}>
                        <IC size={22} color={active ? r.color : '#3D5C3A'} strokeWidth={2} />
                      </View>
                      <Text style={[
                        styles.roleLabel,
                        active && { color: r.color, fontWeight: '700' },
                      ]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => { resetCreateForm(); setCreateVisible(false); }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirm, creating && styles.disabled]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <UserCheck size={16} color="#fff" strokeWidth={2.5} />
                      <Text style={styles.modalConfirmText}>Create Account</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Reset Password Modal ── */}
      <Modal visible={resetVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: 30 }]}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              For{' '}
              <Text style={{ color: '#E8F5E0', fontWeight: '700' }}>
                {selectedWorker?.full_name}
              </Text>
              {'\n'}Email:{' '}
              <Text style={{ color: '#4CAF50' }}>
                {selectedWorker?.email}
              </Text>
            </Text>

            <Text style={styles.modalLabel}>NEW TEMPORARY PASSWORD *</Text>
            <View style={styles.iconInput}>
              <Lock size={16} color="#3D5C3A" strokeWidth={2} />
              <TextInput
                style={styles.iconInputText}
                placeholder="Minimum 6 characters"
                placeholderTextColor="#3D5C3A"
                value={resetPassword}
                onChangeText={setResetPassword}
                secureTextEntry={false} 
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setResetVisible(false);
                  setSelectedWorker(null);
                  setResetPassword('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, resetting && styles.disabled]}
                onPress={handleResetPassword}
                disabled={resetting}
              >
                {resetting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <RefreshCw size={16} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.modalConfirmText}>Reset</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0E1A12' },
  blob:          { position: 'absolute', borderRadius: 999, opacity: 0.08 },
  blob1:         { width: 400, height: 400, backgroundColor: '#3D8B37', top: -150, right: -150 },
  centered:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noAccessText:  { color: '#7FAE7A', fontSize: 16 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerBtn:     { padding: 4 },
  headerTitle:   { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#4CAF50', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  list:          { padding: 20, paddingBottom: 40 },
  emptyState:    { alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyText:     { color: '#7FAE7A', fontSize: 18, fontWeight: '700' },
  emptySubtext:  { color: '#3D5C3A', fontSize: 14, textAlign: 'center', marginTop: 4 },
  workerCard:    { backgroundColor: '#162018', borderRadius: 16, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 12 },
  workerHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  workerIconBox: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  workerName:    { color: '#E8F5E0', fontSize: 17, fontWeight: '700' },
  workerEmail:   { color: '#4CAF50', fontSize: 13, marginTop: 2 },
  workerPhoneRow:{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  workerPhone:   { color: '#3D5C3A', fontSize: 12 },
  workerActions: { flexDirection: 'row', gap: 10 },
  roleBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10 },
  roleBtnWorker:  { borderColor: '#4CAF50' },
  roleBtnManager: { borderColor: '#FFA726' },
  roleBtnText:   { fontSize: 13, fontWeight: '600' },
  resetBtn:      { borderWidth: 1.5, borderColor: '#42A5F5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  deleteBtn:     { borderWidth: 1.5, borderColor: '#EF5350', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: '#162018', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalTitle:    { color: '#E8F5E0', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  modalSubtitle: { color: '#7FAE7A', fontSize: 14, marginBottom: 20, lineHeight: 22 },
  modalLabel:    { color: '#3D5C3A', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  modalInput:    { backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, padding: 14, color: '#E8F5E0', fontSize: 15, marginBottom: 16 },
  iconInput:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 2, marginBottom: 16 },
  iconInputText: { flex: 1, color: '#E8F5E0', fontSize: 15, paddingVertical: 12 },
  roleSelector:  { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleOption:    { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 8 },
  roleOptionActive: { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.06)' },
  roleIconBox:   { width: 44, height: 44, borderRadius: 12, backgroundColor: '#0E1A12', alignItems: 'center', justifyContent: 'center' },
  roleLabel:     { color: '#7FAE7A', fontSize: 14, fontWeight: '600' },
  modalButtons:  { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel:   { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalCancelText:   { color: '#7FAE7A', fontWeight: '600', fontSize: 15 },
  modalConfirm:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 16 },
  disabled:          { opacity: 0.5 },
  modalConfirmText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
});