# PlantHouse - Auth Setup Guide

## Quick Start

### 1. Install dependencies

In your `planthouse` project folder, run:

```bash
npx expo install expo-router @supabase/supabase-js @react-native-async-storage/async-storage
```

### 2. Set up Supabase database

1. Go to https://app.supabase.com → your project
2. Click **SQL Editor** → **New Query**
3. Paste the contents of `supabase_schema.sql` and click **Run**

### 3. Add your Supabase credentials

1. In Supabase: **Settings → API** — copy **Project URL** and **anon/public** key
2. Create a `.env` file in your project root (copy from `.env.example`):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Copy the provided files into your project

Copy these into your `planthouse/` folder:
- `app/_layout.tsx` — replaces root layout
- `app/index.tsx` — welcome screen
- `app/login.tsx` — sign in screen
- `app/register.tsx` — company + boss registration
- `app/home.tsx` — dashboard (after login)
- `context/AuthContext.tsx` — auth state management
- `lib/supabase.ts` — Supabase client

### 5. Update package.json main entry

In your `package.json`, change:
```json
"main": "index.ts"
```
to:
```json
"main": "expo-router/entry"
```

### 6. Update app.json

Add the scheme for expo-router to `app.json`:
```json
{
  "expo": {
    "scheme": "planthouse",
    ...
  }
}
```

### 7. Run the app

```bash
npx expo start
```
Scan the QR code with **Expo Go** on your iPhone.

---

## About Testing / Emulation

**Since you only have an iPhone (no Mac), you cannot use the iOS Simulator** (which requires Xcode on macOS). Here are your options:

### ✅ Option A: Expo Go on your real iPhone (recommended for now)
- Install **Expo Go** from the App Store on your iPhone
- Run `npx expo start` on your PC
- Scan the QR code — app runs live on your phone
- Works great for development, hot reloads instantly

### ✅ Option B: Web browser (for quick UI testing)
- Run `npx expo start --web`
- Opens in your browser on your PC
- Good for layout testing, but some mobile-specific features may differ

### ⚠️ Option C: Android Emulator on Windows
- Install Android Studio → create an AVD (Android Virtual Device)
- Run `npx expo start --android`
- Free, runs on Windows — good for seeing a mobile view without your phone

---

## Supabase Database — Is it real?

**Yes! Supabase is a real PostgreSQL database.** 
- Your free tier gives you a full working database
- Auth is real (email/password with JWT tokens)
- Data persists across sessions
- Free tier is plenty for development and small production apps
- No credit card needed for free tier

---

## File Structure

```
planthouse/
├── app/
│   ├── _layout.tsx      ← Root layout + auth guard
│   ├── index.tsx        ← Welcome screen
│   ├── login.tsx        ← Sign in
│   ├── register.tsx     ← Register company + boss
│   └── home.tsx         ← Dashboard
├── context/
│   └── AuthContext.tsx  ← Auth state
├── lib/
│   └── supabase.ts      ← Supabase client
└── .env                 ← Your credentials (never commit this)
```
