# Supabase Migration Guide

## What Changed

### Removed
- Firebase dependency (`firebase: ^12.4.0`)
- `src/firebase.js` file with Firebase configuration

### Added
- Supabase dependency (`@supabase/supabase-js: ^2.39.0`)
- `src/supabase.js` file with Supabase configuration and auth functions

## Setup Required

### 1. Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Get your project URL and anon key from Settings > API

### 2. Update Configuration
Edit `src/supabase.js` and replace:
```javascript
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
```

### 3. Create Database Schema
Run this SQL in your Supabase SQL Editor:

```sql
-- Create profiles table for user roles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (id)
);

-- Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow service role to insert profiles
CREATE POLICY "Enable insert for service role" ON profiles
  FOR INSERT WITH CHECK (true);
```

### 4. Environment Variables (Optional)
Create `.env.local` file in react-glass folder:
```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Then update `src/supabase.js`:
```javascript
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY
```

## Functions Available

All the same authentication functions are available:
- `signInAndGetRole(email, password)`
- `createUserWithRole(email, password, role)`
- `getRole(uid)`
- `signOutUser()`

The Login component will work the same way after configuration.