// jobs.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft, Plus, Droplets, FlaskConical, Scissors, Package,
  Truck, Pill, Wheat, Search, Trash2, ClipboardList, MapPin,
  HardHat, Users, Clock, CheckCircle, Play, ChevronRight,
  Layers, Crown, Check, X, Filter, Folder,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  job_type: string;
  status: 'not_started' | 'in_progress' | 'completed';
  assigned_to: string;
  assigned_to_name: string;
  created_by_name: string;
  batch_id: string | null;
  batch_plant_name: string | null;
  batch_location: string | null;
  notes: string | null;
  target_location: string | null;
  remove_amount: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  group_id: string | null;
}

interface Worker {
  id: string;
  full_name: string;
  role: string;
}

interface Batch {
  id: string;
  plant_name: string | null;
  location: string | null;
}

interface Location {
  id: string;
  name: string;
}

type LucideIcon = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

// ─── Constants ────────────────────────────────────────────────────────────────

interface JobTypeDef {
  type: string;
  icon: LucideIcon;
  color: string;
}

export const JOB_TYPES: JobTypeDef[] = [
  { type: 'Water',         icon: Droplets,     color: '#0288D1' },
  { type: 'Fertilize',     icon: FlaskConical, color: '#7B1FA2' },
  { type: 'Prune',         icon: Scissors,     color: '#26A69A' },
  { type: 'Repot',         icon: Package,      color: '#FFA726' },
  { type: 'Relocate',      icon: Truck,        color: '#EF5350' },
  { type: 'Treat',         icon: Pill,         color: '#EC407A' },
  { type: 'Harvest',       icon: Wheat,        color: '#FFCA28' },
  { type: 'Inspect',       icon: Search,       color: '#66BB6A' },
  { type: 'Remove Plants', icon: Trash2,       color: '#FF7043' },
  { type: 'Custom',        icon: ClipboardList,color: '#7FAE7A' },
];

export const STATUS_META = {
  not_started: { label: 'Not started', color: '#3D5C3A', bg: 'rgba(61,92,58,0.2)'   },
  in_progress:  { label: 'In progress', color: '#FFA726', bg: 'rgba(255,167,38,0.15)' },
  completed:    { label: 'Completed',   color: '#4CAF50', bg: 'rgba(76,175,80,0.15)'  },
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ─── Searchable Picker ────────────────────────────────────────────────────────

interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
}

interface SearchablePickerProps {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedIds: string[];
  multiSelect?: boolean;
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
  searchPlaceholder?: string;
  noneOption?: boolean;
  noneLabel?: string;
}

function SearchablePicker({
  visible, title, items, selectedIds, multiSelect = false,
  onConfirm, onClose, searchPlaceholder = 'Search...', noneOption = false, noneLabel = 'None',
}: SearchablePickerProps) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string[]>(selectedIds);

  React.useEffect(() => {
    if (visible) { setDraft(selectedIds); setQuery(''); }
  }, [visible]);

  const filtered = items.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    (item.sublabel ?? '').toLowerCase().includes(query.toLowerCase())
  );

  const toggle = (id: string) => {
    if (multiSelect) {
      setDraft(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setDraft([id]);
    }
  };

  const isSelected = (id: string) => draft.includes(id);

  if (!visible) return null;

  return (
    <View style={[sharedStyles.overlay, { zIndex: 20 }]}>
      <TouchableOpacity style={sharedStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ width: '100%', maxHeight: '80%' }}
      >
        <View style={pickerStyles.box}>

          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>{title}</Text>
            {multiSelect && draft.length > 0 && (
              <View style={pickerStyles.countBadge}>
                <Text style={pickerStyles.countBadgeText}>{draft.length} selected</Text>
              </View>
            )}
          </View>

          <View style={pickerStyles.searchRow}>
            <Search size={15} color="#3D5C3A" strokeWidth={2} />
            <TextInput
              style={pickerStyles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor="#3D5C3A"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={pickerStyles.clearBtn}>
                <X size={14} color="#3D5C3A" strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>

          {noneOption && (
            <TouchableOpacity
              style={[pickerStyles.item, draft.length === 0 && pickerStyles.itemSelected]}
              onPress={() => setDraft([])}
            >
              <View style={pickerStyles.itemLeft}>
                <View style={[pickerStyles.itemIconBox, { backgroundColor: '#1E2E1E' }]}>
                  <Text style={{ color: '#3D5C3A', fontSize: 16, fontWeight: '700' }}>—</Text>
                </View>
                <Text style={[pickerStyles.itemLabel, draft.length === 0 && pickerStyles.itemLabelSelected]}>
                  {noneLabel}
                </Text>
              </View>
              {draft.length === 0 && <Check size={16} color="#4CAF50" strokeWidth={3} />}
            </TouchableOpacity>
          )}

          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            style={pickerStyles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={pickerStyles.emptyState}>
                <Text style={pickerStyles.emptyText}>No results for "{query}"</Text>
              </View>
            }
            renderItem={({ item }) => {
              const selected = isSelected(item.id);
              const IC = item.icon;
              return (
                <TouchableOpacity
                  style={[pickerStyles.item, selected && pickerStyles.itemSelected]}
                  onPress={() => toggle(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={pickerStyles.itemLeft}>
                    {IC && (
                      <View style={[pickerStyles.itemIconBox, selected && pickerStyles.itemIconBoxSelected]}>
                        <IC size={18} color={selected ? '#4CAF50' : (item.iconColor ?? '#7FAE7A')} strokeWidth={2} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[pickerStyles.itemLabel, selected && pickerStyles.itemLabelSelected]}>
                        {item.label}
                      </Text>
                      {item.sublabel ? (
                        <Text style={pickerStyles.itemSublabel}>{item.sublabel}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={[pickerStyles.checkbox, selected && pickerStyles.checkboxSelected]}>
                    {selected && <Check size={13} color="#fff" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <View style={pickerStyles.buttons}>
            <TouchableOpacity style={pickerStyles.cancelBtn} onPress={onClose}>
              <Text style={pickerStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[pickerStyles.confirmBtn, (!noneOption && draft.length === 0) && pickerStyles.confirmBtnDisabled]}
              onPress={() => onConfirm(draft)}
              disabled={!noneOption && draft.length === 0}
            >
              <Text style={pickerStyles.confirmBtnText}>
                {multiSelect && draft.length > 1 ? `Confirm (${draft.length})` : 'Confirm'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function JobsScreen() {
  const router = useRouter();
  const { profile, company } = useAuth();
  const isBoss = profile?.role === 'boss';

  const [jobs, setJobs]         = useState<Job[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('active');

  const [createVisible, setCreateVisible]     = useState(false);
  const [workers, setWorkers]                 = useState<Worker[]>([]);
  const [batches, setBatches]                 = useState<Batch[]>([]);
  const [locations, setLocations]             = useState<Location[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedJobType, setSelectedJobType] = useState<string | null>(null);
  const [jobNotes, setJobNotes]               = useState('');
  const [jobTargetLoc, setJobTargetLoc]       = useState('');
  const [jobRemoveAmt, setJobRemoveAmt]       = useState('');
  const [creating, setCreating]               = useState(false);

  const [workerPickerVisible, setWorkerPickerVisible] = useState(false);
  const [batchPickerVisible, setBatchPickerVisible]   = useState(false);

  const [detailJob, setDetailJob]           = useState<Job | null>(null);
  const [detailVisible, setDetailVisible]   = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    let query = supabase.from('jobs').select('*')
      .eq('company_id', company.id).order('created_at', { ascending: false });
    if (!isBoss) query = query.eq('assigned_to', profile?.id);
    const { data, error } = await query;
    if (error) Alert.alert('Error', error.message);
    else if (data) setJobs(data as Job[]);
    setLoading(false);
  }, [company?.id, isBoss, profile?.id]);

  const fetchWorkersAndBatches = useCallback(async () => {
    if (!company?.id || !isBoss) return;
    const [{ data: wData }, { data: bData }, { data: lData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role')
        .eq('company_id', company.id).in('role', ['worker', 'manager']).order('full_name'),
      supabase.from('plant_batches').select('id, location, plants!plant_id ( name )')
        .eq('company_id', company.id).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('locations').select('id, name')
        .eq('company_id', company.id).order('name'),
    ]);
    if (wData) setWorkers(wData as Worker[]);
    if (bData) setBatches(bData.map((b: any) => ({
      id: b.id, plant_name: b.plants?.name ?? 'Unknown', location: b.location ?? null,
    })));
    if (lData) setLocations(lData as Location[]);
  }, [company?.id, isBoss]);

  useFocusEffect(useCallback(() => {
    fetchJobs();
    fetchWorkersAndBatches();
  }, [fetchJobs, fetchWorkersAndBatches]));

  // ── Derived picker data ────────────────────────────────────────────────────

  const workerPickerItems: PickerItem[] = workers.map(w => ({
    id: w.id,
    label: w.full_name,
    sublabel: w.role === 'manager' ? 'Manager' : 'Worker',
    icon: w.role === 'manager' ? ClipboardList : HardHat,
    iconColor: w.role === 'manager' ? '#FFA726' : '#7FAE7A',
  }));

  const batchPickerItems: PickerItem[] = batches.map(b => ({
    id: b.id,
    label: b.plant_name ?? 'Unknown',
    sublabel: b.location ? b.location : undefined,
    icon: Layers,
    iconColor: '#66BB6A',
  }));

  const selectedWorkerNames = selectedWorkers
    .map(id => workers.find(w => w.id === id)?.full_name).filter(Boolean).join(', ');

  const selectedBatchLabels = selectedBatches.length === 0
    ? null
    : selectedBatches.map(id => {
        const b = batches.find(x => x.id === id);
        return b ? `${b.plant_name}${b.location ? ` · ${b.location}` : ''}` : null;
      }).filter(Boolean).join(', ');

  // ── Handlers ──────────────────────────────────────────────────────────────

  const resetCreateForm = () => {
    setSelectedWorkers([]); setSelectedBatches([]); setSelectedJobType(null);
    setJobNotes(''); setJobTargetLoc(''); setJobRemoveAmt('');
  };

  const handleCreate = async () => {
    if (selectedWorkers.length === 0) return Alert.alert('Required', 'Select at least one worker.');
    if (!selectedJobType)             return Alert.alert('Required', 'Select a job type.');

    // One job row per worker × batch combination.
    // If no batches selected, create one job per worker with no batch attached.
    const batchSlots = selectedBatches.length > 0 ? selectedBatches : [null];
    const isGroup    = selectedWorkers.length > 1 || selectedBatches.length > 1;
    const groupId    = isGroup
      ? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        })
      : null;

    setCreating(true);
    const rows: any[] = [];
    for (const wId of selectedWorkers) {
      const w = workers.find(x => x.id === wId);
      for (const batchId of batchSlots) {
        const batchObj = batchId ? batches.find(b => b.id === batchId) : null;
        rows.push({
          company_id:       company?.id,
          assigned_to:      wId,
          assigned_to_name: w?.full_name ?? 'Unknown',
          created_by:       profile?.id,
          created_by_name:  profile?.full_name ?? 'Boss',
          job_type:         selectedJobType,
          batch_id:         batchId ?? null,
          batch_plant_name: batchObj?.plant_name ?? null,
          batch_location:   batchObj?.location ?? null,
          notes:            jobNotes.trim() || null,
          target_location:  selectedJobType === 'Relocate' ? jobTargetLoc.trim() || null : null,
          remove_amount:    selectedJobType === 'Remove Plants' && jobRemoveAmt.trim()
                              ? parseInt(jobRemoveAmt) : null,
          group_id:         groupId,
        });
      }
    }

    const { error } = await supabase.from('jobs').insert(rows);
    setCreating(false);
    if (error) { Alert.alert('Error', error.message); return; }

    const workerNames = selectedWorkers.map(id => workers.find(w => w.id === id)?.full_name).join(', ');
    const batchCount  = selectedBatches.length;
    Alert.alert(
      'Jobs Created',
      batchCount > 1
        ? `${rows.length} job(s) created — ${batchCount} batches assigned to ${workerNames}.`
        : `Job assigned to ${workerNames}.`
    );
    resetCreateForm();
    setCreateVisible(false);
    fetchJobs();
  };

  const handleStartJob = async (job: Job) => {
    setUpdatingStatus(true);
    const now = new Date().toISOString();
    const q = (job as any).group_id
      ? supabase.from('jobs').update({ status: 'in_progress', started_at: now }).eq('group_id', (job as any).group_id)
      : supabase.from('jobs').update({ status: 'in_progress', started_at: now }).eq('id', job.id);
    const { error } = await q;
    setUpdatingStatus(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setDetailJob({ ...job, status: 'in_progress', started_at: now });
    fetchJobs();
  };

  const handleCompleteJob = async (job: Job) => {
    if (job.job_type === 'Remove Plants' && job.remove_amount != null && job.batch_id) {
      Alert.prompt(
        'Remove Plants',
        `This will remove ${job.remove_amount} plant(s) from the batch.\n\nReason (optional):`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove & Complete', style: 'destructive',
            onPress: async (reason?: string) => {
              setUpdatingStatus(true);
              const { data: bd, error: bfe } = await supabase
                .from('plant_batches').select('current_quantity').eq('id', job.batch_id).single();
              if (bfe || !bd) { setUpdatingStatus(false); Alert.alert('Error', 'Could not fetch batch.'); return; }
              const newQty = bd.current_quantity - job.remove_amount!;
              if (newQty < 0) { setUpdatingStatus(false); Alert.alert('Error', `Only ${bd.current_quantity} plants available.`); return; }
              await supabase.from('plant_batches').update({ current_quantity: newQty }).eq('id', job.batch_id);
              await supabase.from('batch_removals').insert({
                batch_id: job.batch_id, company_id: company?.id, amount: job.remove_amount,
                reason: reason?.trim() || `Job: ${job.notes ?? 'Remove Plants'}`,
                removed_by: profile?.id, removed_by_name: profile?.full_name ?? 'Unknown',
              });
              const completedAt = new Date().toISOString();
              const jq = (job as any).group_id
                ? supabase.from('jobs').update({ status: 'completed', completed_at: completedAt }).eq('group_id', (job as any).group_id)
                : supabase.from('jobs').update({ status: 'completed', completed_at: completedAt }).eq('id', job.id);
              await jq;
              setUpdatingStatus(false);
              setDetailVisible(false); setDetailJob(null); fetchJobs();
            },
          },
        ], 'plain-text'
      );
      return;
    }

    Alert.alert('Mark as Completed?', 'Confirm that this job is fully done.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, complete it',
        onPress: async () => {
          setUpdatingStatus(true);
          const completedAt = new Date().toISOString();
          const jq = (job as any).group_id
            ? supabase.from('jobs').update({ status: 'completed', completed_at: completedAt }).eq('group_id', (job as any).group_id)
            : supabase.from('jobs').update({ status: 'completed', completed_at: completedAt }).eq('id', job.id);
          const { error } = await jq;
          setUpdatingStatus(false);
          if (error) { Alert.alert('Error', error.message); return; }
          setDetailVisible(false); setDetailJob(null); fetchJobs();
        },
      },
    ]);
  };

  const handleDeleteJob = (job: Job) => {
    Alert.alert('Delete Job', `Delete this job assigned to ${job.assigned_to_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await supabase.from('jobs').delete().eq('id', job.id); fetchJobs(); },
      },
    ]);
  };

  const filteredJobs = jobs.filter(j => {
    if (filterStatus === 'active')    return j.status !== 'completed';
    if (filterStatus === 'completed') return j.status === 'completed';
    return true;
  });

  const getJobTypeMeta = (type: string) =>
    JOB_TYPES.find(t => t.type === type) ?? { icon: ClipboardList, color: '#7FAE7A' };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />

      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <ArrowLeft size={20} color="#7FAE7A" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isBoss ? 'Jobs' : 'My Jobs'}</Text>
          {isBoss && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setCreateVisible(true)}>
              <Plus size={15} color="#fff" strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Job</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 48 }} contentContainerStyle={styles.filterRow}>
          {([
            { key: 'active',    label: 'Active',    icon: Clock         },
            { key: 'completed', label: 'Completed', icon: CheckCircle   },
            { key: 'all',       label: 'All',       icon: Folder        },
          ] as const).map(f => {
            const IC = f.icon;
            const active = filterStatus === f.key;
            return (
              <TouchableOpacity key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilterStatus(f.key)}>
                <IC size={13} color={active ? '#4CAF50' : '#7FAE7A'} strokeWidth={2} />
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color="#4CAF50" size="large" /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {filteredJobs.length === 0 ? (
              <View style={styles.emptyState}>
                <ClipboardList size={48} color="#3D5C3A" strokeWidth={1.5} />
                <Text style={styles.emptyText}>No jobs here</Text>
                <Text style={styles.emptySubtext}>
                  {isBoss ? 'Tap "+ Job" to assign work to your team' : 'No jobs assigned to you yet'}
                </Text>
              </View>
            ) : (
              filteredJobs.map(job => {
                const meta   = getJobTypeMeta(job.job_type);
                const status = STATUS_META[job.status];
                const IC = meta.icon;
                return (
                  <TouchableOpacity key={job.id} style={styles.jobCard}
                    onPress={() => { setDetailJob(job); setDetailVisible(true); }}
                    onLongPress={() => isBoss && handleDeleteJob(job)}
                    activeOpacity={0.8}>
                    <View style={styles.jobCardTop}>
                      <View style={[styles.jobIconBox, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
                        <IC size={20} color={meta.color} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.jobType}>{job.job_type}</Text>
                        {job.batch_plant_name && (
                          <View style={styles.jobBatchRow}>
                            <Layers size={11} color="#7FAE7A" strokeWidth={2} />
                            <Text style={styles.jobBatch}>
                              {job.batch_plant_name}{job.batch_location ? `  ·  ${job.batch_location}` : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.color + '66' }]}>
                        <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>
                    <View style={styles.jobMeta}>
                      <View style={styles.jobMetaLeft}>
                        {isBoss
                          ? <><HardHat size={11} color="#3D5C3A" strokeWidth={2} /><Text style={styles.jobMetaText}>{job.assigned_to_name}{job.group_id ? '  ·  Group' : ''}</Text></>
                          : <><Crown size={11} color="#3D5C3A" strokeWidth={2} /><Text style={styles.jobMetaText}>from {job.created_by_name}{job.group_id ? '  ·  Group' : ''}</Text></>
                        }
                      </View>
                      <Text style={styles.jobMetaText}>{formatDate(job.created_at)}</Text>
                    </View>
                    {job.notes ? <Text style={styles.jobNotes} numberOfLines={2}>{job.notes}</Text> : null}
                    {isBoss && <Text style={styles.longPressHint}>Long press to delete</Text>}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* ══════════════════════════════════════════════════════════════
          OVERLAY PANELS — all absolute, outside SafeAreaView.
          zIndex 10 = create / detail panels
          zIndex 20 = pickers (always on top)
      ══════════════════════════════════════════════════════════════ */}

      {/* Create Job Panel */}
      {createVisible && (
        <View style={[sharedStyles.overlay, { zIndex: 10 }]}>
          <TouchableOpacity style={sharedStyles.backdrop} activeOpacity={1}
            onPress={() => { resetCreateForm(); setCreateVisible(false); }} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}>
            <View style={sharedStyles.sheet}>
              <ScrollView keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>

                <Text style={styles.panelTitle}>Assign New Job</Text>

                {/* Worker selector */}
                <Text style={styles.panelLabel}>ASSIGN TO *</Text>
                <TouchableOpacity style={styles.selectorBtn} onPress={() => setWorkerPickerVisible(true)}>
                  <View style={styles.selectorBtnLeft}>
                    <View style={styles.selectorBtnIconBox}>
                      <HardHat size={18} color="#7FAE7A" strokeWidth={2} />
                    </View>
                    {selectedWorkers.length === 0 ? (
                      <Text style={styles.selectorBtnPlaceholder}>Tap to select worker(s)...</Text>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectorBtnValue} numberOfLines={2}>{selectedWorkerNames}</Text>
                        {selectedWorkers.length > 1 && (
                          <View style={styles.selectorBtnMetaRow}>
                            <Users size={11} color="#4CAF50" strokeWidth={2} />
                            <Text style={styles.selectorBtnMeta}>Group job · {selectedWorkers.length} workers</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  <ChevronRight size={18} color="#4CAF50" strokeWidth={2.5} />
                </TouchableOpacity>

                {/* Job type grid */}
                <Text style={styles.panelLabel}>JOB TYPE *</Text>
                <View style={styles.jobTypeGrid}>
                  {JOB_TYPES.map(jt => {
                    const IC = jt.icon;
                    const active = selectedJobType === jt.type;
                    return (
                      <TouchableOpacity key={jt.type}
                        style={[styles.jobTypeBtn, active && { borderColor: jt.color, backgroundColor: jt.color + '22' }]}
                        onPress={() => setSelectedJobType(jt.type === selectedJobType ? null : jt.type)}>
                        <IC size={15} color={active ? jt.color : '#7FAE7A'} strokeWidth={2} />
                        <Text style={[styles.jobTypeLabel, active && { color: jt.color, fontWeight: '700' }]}>
                          {jt.type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Batch selector */}
                <Text style={styles.panelLabel}>BATCH (optional)</Text>
                <TouchableOpacity style={styles.selectorBtn} onPress={() => setBatchPickerVisible(true)}>
                  <View style={styles.selectorBtnLeft}>
                    <View style={styles.selectorBtnIconBox}>
                      <Layers size={18} color="#7FAE7A" strokeWidth={2} />
                    </View>
                    {selectedBatches.length === 0 ? (
                      <Text style={styles.selectorBtnPlaceholder}>Tap to select batch(es)...</Text>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectorBtnValue} numberOfLines={2}>{selectedBatchLabels}</Text>
                        {selectedBatches.length > 1 && (
                          <View style={styles.selectorBtnMetaRow}>
                            <Layers size={11} color="#4CAF50" strokeWidth={2} />
                            <Text style={styles.selectorBtnMeta}>{selectedBatches.length} batches selected</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  <ChevronRight size={18} color="#4CAF50" strokeWidth={2.5} />
                </TouchableOpacity>

                {/* Relocate extras */}
                {selectedJobType === 'Relocate' && (() => {
                  // For relocate with multiple batches, skip per-batch current location filtering
                  const availableLocs = selectedBatches.length === 1
                    ? locations.filter(l => l.name.trim().toLowerCase() !== (batches.find(b => b.id === selectedBatches[0])?.location ?? '').trim().toLowerCase())
                    : locations;
                  return (
                    <>
                      <Text style={styles.panelLabel}>TARGET LOCATION</Text>
                      {availableLocs.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                          {availableLocs.map(loc => (
                            <TouchableOpacity key={loc.id}
                              style={[styles.locChip, jobTargetLoc === loc.name && styles.locChipActive]}
                              onPress={() => setJobTargetLoc(jobTargetLoc === loc.name ? '' : loc.name)}>
                              <MapPin size={12} color={jobTargetLoc === loc.name ? '#EF5350' : '#7FAE7A'} strokeWidth={2} />
                              <Text style={[styles.locChipText, jobTargetLoc === loc.name && styles.locChipTextActive]}>
                                {loc.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                      <TextInput style={[styles.panelInput, { marginBottom: 16 }]}
                        placeholder={availableLocs.length > 0 ? 'Or type a custom location...' : 'No locations — type manually'}
                        placeholderTextColor="#3D5C3A" value={jobTargetLoc} onChangeText={setJobTargetLoc} />
                    </>
                  );
                })()}

                {/* Remove Plants extras */}
                {selectedJobType === 'Remove Plants' && (
                  <>
                    <Text style={styles.panelLabel}>AMOUNT TO REMOVE</Text>
                    <TextInput style={styles.panelInput}
                      placeholder="Number of plants to remove"
                      placeholderTextColor="#3D5C3A" value={jobRemoveAmt}
                      onChangeText={setJobRemoveAmt} keyboardType="numeric" />
                  </>
                )}

                {/* Notes */}
                <Text style={styles.panelLabel}>NOTES (optional)</Text>
                <TextInput style={[styles.panelInput, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Any instructions for the worker..."
                  placeholderTextColor="#3D5C3A" value={jobNotes}
                  onChangeText={setJobNotes} multiline />

                <View style={styles.panelButtons}>
                  <TouchableOpacity style={styles.panelCancel}
                    onPress={() => { resetCreateForm(); setCreateVisible(false); }}>
                    <Text style={styles.panelCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.panelConfirm, creating && styles.disabled]}
                    onPress={handleCreate} disabled={creating}>
                    {creating
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.panelConfirmText}>Assign Job</Text>
                    }
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Worker Picker */}
      <SearchablePicker
        visible={workerPickerVisible}
        title="Select Worker(s)"
        items={workerPickerItems}
        selectedIds={selectedWorkers}
        multiSelect
        searchPlaceholder="Search by name..."
        onConfirm={ids => { setSelectedWorkers(ids); setWorkerPickerVisible(false); }}
        onClose={() => setWorkerPickerVisible(false)}
      />

      {/* Batch Picker */}
      <SearchablePicker
        visible={batchPickerVisible}
        title="Select Batch(es)"
        items={batchPickerItems}
        selectedIds={selectedBatches}
        multiSelect={true}
        searchPlaceholder="Search by plant or location..."
        noneOption
        noneLabel="No batch"
        onConfirm={ids => { setSelectedBatches(ids); setBatchPickerVisible(false); }}
        onClose={() => setBatchPickerVisible(false)}
      />

      {/* Job Detail Panel */}
      {detailJob && detailVisible && (
        <View style={[sharedStyles.overlay, { zIndex: 10 }]}>
          <TouchableOpacity style={sharedStyles.backdrop} activeOpacity={1}
            onPress={() => { setDetailVisible(false); setDetailJob(null); }} />
          <View style={sharedStyles.sheet}>
            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
              {(() => {
                const meta   = getJobTypeMeta(detailJob.job_type);
                const status = STATUS_META[detailJob.status];
                const IC = meta.icon;
                return (
                  <>
                    <View style={styles.detailHeader}>
                      <View style={[styles.jobIconBox, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
                        <IC size={22} color={meta.color} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.panelTitle}>{detailJob.job_type}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.color + '66', alignSelf: 'flex-start', marginTop: 4 }]}>
                          <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                    </View>

                    {detailJob.batch_plant_name && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Batch</Text>
                        <View style={styles.detailValueRow}>
                          <Layers size={13} color="#7FAE7A" strokeWidth={2} />
                          <Text style={styles.detailValue}>
                            {detailJob.batch_plant_name}{detailJob.batch_location ? `  ·  ${detailJob.batch_location}` : ''}
                          </Text>
                        </View>
                      </View>
                    )}
                    {detailJob.target_location && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Move to</Text>
                        <View style={styles.detailValueRow}>
                          <MapPin size={13} color="#7FAE7A" strokeWidth={2} />
                          <Text style={styles.detailValue}>{detailJob.target_location}</Text>
                        </View>
                      </View>
                    )}
                    {detailJob.remove_amount != null && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Remove</Text>
                        <Text style={styles.detailValue}>{detailJob.remove_amount} plants</Text>
                      </View>
                    )}
                    {isBoss && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Assigned to</Text>
                        <View style={styles.detailValueRow}>
                          <HardHat size={13} color="#7FAE7A" strokeWidth={2} />
                          <Text style={styles.detailValue}>{detailJob.assigned_to_name}</Text>
                        </View>
                      </View>
                    )}
                    {detailJob.notes && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Notes</Text>
                        <Text style={styles.detailValue}>{detailJob.notes}</Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Created</Text>
                      <Text style={styles.detailValue}>{formatDate(detailJob.created_at)}</Text>
                    </View>
                    {detailJob.started_at && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Started</Text>
                        <Text style={styles.detailValue}>{formatDate(detailJob.started_at)}</Text>
                      </View>
                    )}
                    {detailJob.completed_at && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Completed</Text>
                        <Text style={styles.detailValue}>{formatDate(detailJob.completed_at)}</Text>
                      </View>
                    )}

                    {!isBoss && detailJob.batch_id && (
                      <TouchableOpacity style={styles.goBatchBtn}
                        onPress={() => { setDetailVisible(false); router.push(`/batch-show?id=${detailJob.batch_id}`); }}>
                        <Layers size={16} color="#4CAF50" strokeWidth={2} />
                        <Text style={styles.goBatchBtnText}>Open Batch → Perform Action</Text>
                        <ChevronRight size={16} color="#4CAF50" strokeWidth={2.5} />
                      </TouchableOpacity>
                    )}

                    {!isBoss && (
                      <View style={[styles.panelButtons, { marginTop: 16 }]}>
                        {detailJob.status === 'not_started' && (
                          <TouchableOpacity
                            style={[styles.panelConfirm, { backgroundColor: '#FFA726' }, updatingStatus && styles.disabled]}
                            onPress={() => handleStartJob(detailJob)} disabled={updatingStatus}>
                            {updatingStatus ? <ActivityIndicator color="#fff" /> : (
                              <><Play size={15} color="#fff" strokeWidth={2.5} /><Text style={styles.panelConfirmText}>Start Job</Text></>
                            )}
                          </TouchableOpacity>
                        )}
                        {detailJob.status === 'in_progress' && (
                          <TouchableOpacity
                            style={[styles.panelConfirm, { backgroundColor: '#4CAF50' }, updatingStatus && styles.disabled]}
                            onPress={() => handleCompleteJob(detailJob)} disabled={updatingStatus}>
                            {updatingStatus ? <ActivityIndicator color="#fff" /> : (
                              <><Check size={15} color="#fff" strokeWidth={3} /><Text style={styles.panelConfirmText}>Mark Complete</Text></>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <TouchableOpacity style={[styles.panelCancel, { marginTop: 12 }]}
                      onPress={() => { setDetailVisible(false); setDetailJob(null); }}>
                      <Text style={styles.panelCancelText}>Close</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      )}

    </View>
  );
}

// ─── Shared overlay styles ────────────────────────────────────────────────────

const sharedStyles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end',
  },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#162018', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%',
  },
});

// ─── Picker styles ────────────────────────────────────────────────────────────

const pickerStyles = StyleSheet.create({
  box: { backgroundColor: '#162018', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 24, paddingBottom: 32 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 16 },
  title:          { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  countBadge:     { backgroundColor: 'rgba(76,175,80,0.2)', borderWidth: 1, borderColor: '#4CAF50', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countBadgeText: { color: '#4CAF50', fontSize: 12, fontWeight: '700' },
  searchRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 14, marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 2 },
  searchInput:    { flex: 1, color: '#E8F5E0', fontSize: 15, paddingVertical: 12 },
  clearBtn:       { padding: 6 },
  list:           { maxHeight: 340 },
  emptyState:     { alignItems: 'center', paddingVertical: 40 },
  emptyText:      { color: '#3D5C3A', fontSize: 14 },
  item:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A2A1A' },
  itemSelected:   { backgroundColor: 'rgba(76,175,80,0.08)' },
  itemLeft:       { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  itemIconBox:    { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0E1A12', alignItems: 'center', justifyContent: 'center' },
  itemIconBoxSelected: { backgroundColor: 'rgba(76,175,80,0.15)' },
  itemLabel:      { color: '#E8F5E0', fontSize: 15, fontWeight: '600' },
  itemLabelSelected: { color: '#4CAF50' },
  itemSublabel:   { color: '#3D5C3A', fontSize: 12, marginTop: 2 },
  checkbox:       { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: '#243524', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  checkmark:      { color: '#fff', fontSize: 13, fontWeight: '800' },
  buttons:        { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1A2A1A', marginTop: 4 },
  cancelBtn:      { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText:  { color: '#7FAE7A', fontWeight: '600', fontSize: 15 },
  confirmBtn:     { flex: 1, backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ─── Main styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0E1A12' },
  blob:         { position: 'absolute', borderRadius: 999, opacity: 0.08 },
  blob1:        { width: 400, height: 400, backgroundColor: '#3D8B37', top: -150, right: -150 },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerBtn:    { padding: 4 },
  headerTitle:  { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#4CAF50', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },

  filterRow:            { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  filterChip:           { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#243524', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  filterChipActive:     { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.15)' },
  filterChipText:       { color: '#7FAE7A', fontSize: 13 },
  filterChipTextActive: { color: '#4CAF50', fontWeight: '700' },

  list:         { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  emptyState:   { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:    { color: '#7FAE7A', fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: '#3D5C3A', fontSize: 14, textAlign: 'center' },

  jobCard:      { backgroundColor: '#162018', borderRadius: 16, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 12 },
  jobCardTop:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  jobIconBox:   { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  jobType:      { color: '#E8F5E0', fontSize: 16, fontWeight: '700' },
  jobBatchRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  jobBatch:     { color: '#7FAE7A', fontSize: 12 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  jobMeta:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  jobMetaLeft:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  jobMetaText:  { color: '#3D5C3A', fontSize: 12 },
  jobNotes:     { color: '#7FAE7A', fontSize: 13, marginTop: 4, lineHeight: 18 },
  longPressHint:{ color: '#243524', fontSize: 10, textAlign: 'right', marginTop: 8 },

  panelTitle:       { color: '#E8F5E0', fontSize: 20, fontWeight: '800', marginBottom: 16 },
  panelLabel:       { color: '#3D5C3A', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  panelInput:       { backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: '#E8F5E0', fontSize: 15, marginBottom: 16 },
  panelButtons:     { flexDirection: 'row', gap: 12, marginTop: 8 },
  panelCancel:      { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  panelCancelText:  { color: '#7FAE7A', fontWeight: '600', fontSize: 15 },
  panelConfirm:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 16 },
  panelConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled:         { opacity: 0.5 },

  selectorBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
  selectorBtnLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  selectorBtnIconBox:     { width: 32, height: 32, borderRadius: 8, backgroundColor: '#162018', alignItems: 'center', justifyContent: 'center' },
  selectorBtnPlaceholder: { color: '#3D5C3A', fontSize: 15 },
  selectorBtnValue:       { color: '#E8F5E0', fontSize: 15, fontWeight: '600', flex: 1 },
  selectorBtnMetaRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  selectorBtnMeta:        { color: '#4CAF50', fontSize: 12 },

  jobTypeGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  jobTypeBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0E1A12' },
  jobTypeLabel: { color: '#7FAE7A', fontSize: 13 },

  locChip:          { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#243524', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8 },
  locChipActive:    { borderColor: '#EF5350', backgroundColor: 'rgba(239,83,80,0.12)' },
  locChipText:      { color: '#7FAE7A', fontSize: 13, fontWeight: '600' },
  locChipTextActive:{ color: '#EF5350', fontWeight: '700' },

  detailHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  detailRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E2E1E' },
  detailLabel:    { color: '#3D5C3A', fontSize: 13, fontWeight: '600' },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },
  detailValue:    { color: '#E8F5E0', fontSize: 14, textAlign: 'right', marginLeft: 8 },
  goBatchBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1.5, borderColor: '#4CAF50', borderRadius: 12, paddingVertical: 14, marginTop: 16 },
  goBatchBtnText: { color: '#4CAF50', fontWeight: '700', fontSize: 15 },
});