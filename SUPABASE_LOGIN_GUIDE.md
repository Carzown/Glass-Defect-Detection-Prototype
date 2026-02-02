# Supabase Integration - Debugging Guide

## Issue: Login/Fetch Failures

The login is failing because the Supabase backend is not properly configured. Here's what you need to do:

## ✅ Quick Setup (5 minutes)

### Step 1: Verify Supabase Credentials
Your current credentials in `.env.local`:
```
REACT_APP_SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ These are already configured and should be valid.

### Step 2: Create the `profiles` Table

1. Go to your **Supabase Dashboard** (https://app.supabase.com)
2. Select your project: **Glass Defect Detection** (kfeztemgrbkfwaicvgnk)
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste this SQL:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'employee',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);
```

6. Click **Run** (or Ctrl+Enter)
7. You should see "Success" message

### Step 3: Create a Test User

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add User**
3. Fill in:
   - **Email**: `test@example.com`
   - **Password**: `TestPassword123!`
4. Click **Create User**
5. **Copy the User ID** (UUID shown in the user details)

### Step 4: Create Profile for the User

1. Go to **SQL Editor** again
2. Click **New Query**
3. Replace `YOUR_USER_ID_HERE` with the UUID from Step 3:

```sql
INSERT INTO profiles (id, email, role) 
VALUES (
  'YOUR_USER_ID_HERE',
  'test@example.com',
  'employee'
);
```

4. Click **Run**
5. You should see "Success" and "1 row inserted"

### Step 5: Test Login

1. Go back to http://localhost:3000
2. Try logging in with:
   - **Email**: `test@example.com`
   - **Password**: `TestPassword123!`
   - Select **Employee** role
3. Click **Sign In**

If successful, you should be redirected to the Dashboard!

## ❌ Troubleshooting

### "Invalid email or password"
- Make sure the email and password match exactly what you created in Step 3
- Check if user exists: Go to **Authentication** → **Users** in Supabase Dashboard

### "Cannot read properties of null"
- The `profiles` table doesn't exist
- Run the SQL from Step 2 in **SQL Editor**

### Still getting errors?
1. Open **Browser Console** (Press F12)
2. Look for red error messages
3. Share the error message - it will tell you exactly what's wrong

## 🔍 Verify Your Setup

Check these in Supabase Dashboard:

**Database → Tables:**
- ✅ `profiles` table exists
- ✅ Columns: `id`, `email`, `role`, `created_at`

**Authentication → Users:**
- ✅ At least one user exists
- ✅ Note the user's UUID

**profiles table → Data:**
- ✅ Row exists with matching UUID and email

## 📝 For Production Use

After testing, you should:
1. Create proper user accounts (don't hardcode passwords)
2. Set up email verification
3. Configure RLS policies more restrictively
4. Never share the `.env.local` file in git (keep it in `.gitignore`)

## Still Having Issues?

Check the browser console for detailed error messages:
1. Press F12 to open Developer Tools
2. Go to **Console** tab
3. Look for any red errors starting with "❌"
4. These will tell you exactly what's missing or misconfigured

The logs will now show:
- ✅ If Supabase initialized successfully
- ❌ If environment variables are missing
- ✅ If user authenticated successfully
- ⚠️ If profile table couldn't be accessed
