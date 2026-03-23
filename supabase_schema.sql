-- ============================================================
-- PLANTHOUSE - Supabase Database Schema
-- Run this in your Supabase SQL Editor (https://app.supabase.com)
-- Project -> SQL Editor -> New Query -> Paste & Run
-- ============================================================

-- Companies table
CREATE TABLE companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('boss', 'worker')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies: users can read their own company
CREATE POLICY "Users can view their company"
  ON companies FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policies: users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Boss can view all profiles in their company
CREATE POLICY "Boss can view company profiles"
  ON profiles FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'boss'
    )
  );

-- Function: auto-create profile after signup
-- (We handle this manually in the app for company registration flow)

-- Allow inserting companies and profiles during registration
-- (Done via service role or anon with special policy)
CREATE POLICY "Allow company registration"
  ON companies FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow profile creation on signup"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());
