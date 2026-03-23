import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Category { id: string; name: string; icon: string; }

const CATEGORY_ICONS = ['🌸', '🌳', '🌿', '🌵', '🍀', '🌾', '🪴', '🌺', '🍃', '🫚'];

const DEFAULT_CATEGORIES = [
  { name: 'Flowers', icon: '🌸' },
  { name: 'Trees', icon: '🌳' },
  { name: 'Shrubs & Bushes', icon: '🌿' },
  { name: 'Cacti & Succulents', icon: '🌵' },
  { name: 'Herbs & Spices', icon: '🍀' },
  { name: 'Vegetables & Edibles', icon: '🌾' },
  { name: 'Indoor & House Plants', icon: '🪴' },
  { name: 'Orchids & Exotic', icon: '🌺' },
  { name: 'Ferns & Foliage', icon: '🍃' },
  { name: 'Climbers & Vines', icon: '🫚' },
];

export default function PlantCategoriesScreen() {
  const router = useRouter();
  const { profile, company } = useAuth();
  const isBoss = profile?.role === 'boss' || profile?.role === 'manager';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('🌿');
  const [catLoading, setCatLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('plant_categories').select('*').eq('company_id', company?.id).order('name');
    if (data) setCategories(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!catName.trim()) return Alert.alert('Required', 'Enter a category name.');
    setCatLoading(true);
    const { error } = await supabase.from('plant_categories').insert({
      company_id: company?.id, name: catName.trim(), icon: catIcon,
    });
    setCatLoading(false);
    if (error) return Alert.alert('Error', error.message);
    setCatName(''); setCatIcon('🌿'); setModalVisible(false); fetchCategories();
  };

  const handleSeedCategories = () => {
    Alert.alert('Add Basic Categories',
      'This will instantly add 10 common plant categories. You can edit or delete them anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add 10 Basics', onPress: async () => {
          setSeedLoading(true);
          const { error } = await supabase.from('plant_categories').insert(
            DEFAULT_CATEGORIES.map(cat => ({ company_id: company?.id, name: cat.name, icon: cat.icon }))
          );
          setSeedLoading(false);
          if (error) { Alert.alert('Error', error.message); return; }
          Alert.alert('Success', '10 basic categories added!');
          fetchCategories();
        }},
      ]
    );
  };

  const handleDelete = (cat: Category) => {
    Alert.alert('Delete Category', `Delete "${cat.name}"? Plants will become uncategorized.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('plant_categories').delete().eq('id', cat.id);
        fetchCategories();
      }},
    ]);
  };

  if (!isBoss) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0E1A12', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#7FAE7A', fontSize: 16 }}>Access denied</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plant Categories</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={handleSeedCategories} style={[styles.seedBtn, seedLoading && styles.btnDisabled]} disabled={seedLoading || catLoading}>
              {seedLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.seedBtnText}>+ Basics</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={[styles.addBtn, catLoading && styles.btnDisabled]} disabled={catLoading || seedLoading}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#4CAF50" size="large" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {categories.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🗂️</Text>
                <Text style={styles.emptyText}>No categories yet</Text>
                <Text style={styles.emptySubtext}>Use "+ Basics" to quickly add 10 common categories, or "+ Add" for custom ones.</Text>
              </View>
            ) : (
              categories.map(cat => (
                <View key={cat.id} style={styles.catCard}>
                  <View style={styles.catCardLeft}>
                    <View style={styles.catIconBox}><Text style={styles.catIcon}>{cat.icon}</Text></View>
                    <Text style={styles.catName}>{cat.name}</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(cat)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        )}

        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>New Category</Text>
                <Text style={styles.modalLabel}>Name</Text>
                <TextInput style={styles.modalInput} placeholder="e.g. Flowers, Trees..." placeholderTextColor="#3D5C3A" value={catName} onChangeText={setCatName} autoFocus />
                <Text style={styles.modalLabel}>Icon</Text>
                <View style={styles.iconGrid}>
                  {CATEGORY_ICONS.map(icon => (
                    <TouchableOpacity key={icon} style={[styles.iconOption, catIcon === icon && styles.iconOptionActive]} onPress={() => setCatIcon(icon)}>
                      <Text style={styles.iconOptionText}>{icon}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirm} onPress={handleAdd} disabled={catLoading}>
                    {catLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Add Category</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1A12' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.1 },
  blob1: { width: 350, height: 350, backgroundColor: '#3D8B37', top: -100, right: -120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  backText: { color: '#7FAE7A', fontSize: 16 },
  headerTitle: { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  addBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  seedBtn: { backgroundColor: '#7FAE7A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  btnDisabled: { opacity: 0.6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  seedBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#7FAE7A', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubtext: { color: '#3D5C3A', fontSize: 14, textAlign: 'center', marginTop: 8 },
  catCard: { backgroundColor: '#162018', borderRadius: 16, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  catIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#0E1A12', borderWidth: 1, borderColor: '#243524', alignItems: 'center', justifyContent: 'center' },
  catIcon: { fontSize: 26 },
  catName: { color: '#E8F5E0', fontSize: 17, fontWeight: '700' },
  deleteBtn: { borderWidth: 1, borderColor: '#ff4444', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  deleteBtnText: { color: '#ff4444', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#162018', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { color: '#E8F5E0', fontSize: 20, fontWeight: '800', marginBottom: 20 },
  modalLabel: { color: '#7FAE7A', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  modalInput: { backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: '#E8F5E0', fontSize: 15, marginBottom: 16 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  iconOption: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#243524', alignItems: 'center', justifyContent: 'center' },
  iconOptionActive: { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.15)' },
  iconOptionText: { fontSize: 24 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalCancelText: { color: '#7FAE7A', fontWeight: '600' },
  modalConfirm: { flex: 1, backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});