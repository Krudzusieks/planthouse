import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const leafAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/home');
    });

    Animated.sequence([
      Animated.timing(leafAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />

      <SafeAreaView style={styles.safe}>
        <Animated.View
          style={[styles.logoArea, { opacity: leafAnim, transform: [{ scale: leafAnim }] }]}
        >
          <View style={styles.iconRing}>
            <Text style={styles.icon}>🌿</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.textArea, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <Text style={styles.appName}>PlantHouse</Text>
          <Text style={styles.tagline}>Garden center management,{'\n'}grown for your team.</Text>
        </Animated.View>

        <Animated.View style={[styles.buttonArea, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/register')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Register a Company</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.Text style={[styles.footer, { opacity: fadeAnim }]}>
          Your greenhouse, your rules.
        </Animated.Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1A12' },
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.15 },
  blob1: { width: 320, height: 320, backgroundColor: '#3D8B37', top: -80, right: -100 },
  blob2: { width: 240, height: 240, backgroundColor: '#5BA85F', bottom: 60, left: -80 },
  logoArea: { alignItems: 'center', marginTop: 40 },
  iconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(93,168,95,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(93,168,95,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 48 },
  textArea: { alignItems: 'center' },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#E8F5E0',
    letterSpacing: -1.5,
    marginBottom: 12,
  },
  tagline: { fontSize: 16, color: '#7FAE7A', textAlign: 'center', lineHeight: 24 },
  buttonArea: { width: '100%', gap: 12 },
  primaryBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(93,168,95,0.5)',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#7FAE7A', fontSize: 17, fontWeight: '600' },
  footer: { color: '#3D5C3A', fontSize: 13, fontStyle: 'italic' },
});