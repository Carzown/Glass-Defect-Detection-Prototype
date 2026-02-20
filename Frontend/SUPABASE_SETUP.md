# Supabase Integration Guide

## Overview
The Frontend application fetches glass defect data from Supabase in real-time. This document explains the setup and troubleshooting.

## Environment Variables
Create a `.env.local` file in the `Frontend/` directory with:

```
REACT_APP_SUPABASE_URL=https://kfeztemgrbkfwaicvgnk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM4NDIsImV4cCI6MjA3Njc3OTg0Mn0.n4F6v_kywu55Nj2Yx_dcZri4WsdUMaftzPl1FXT-to8
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
REACT_APP_ENABLE_SUPABASE_REALTIME=true
```

## Database Schema

The `defects` table must exist in Supabase with the following schema:

```sql
CREATE TABLE defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT,
  defect_type TEXT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  confidence FLOAT,
  image_url TEXT,
  image_path TEXT,
  status TEXT DEFAULT 'pending', -- pending, reviewed, resolved
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX defects_detected_at_idx ON defects(detected_at DESC);
CREATE INDEX defects_status_idx ON defects(status);
```

## How Data Flows

1. **Dashboard Component** (`Frontend/src/pages/Dashboard.js`)
   - Mounts and calls `loadSupabaseDefects()`
   - Sets up a polling interval (every 3 seconds) to fetch defects
   - Displays defects in a list with timestamps and types

2. **Defect Service** (`Frontend/src/services/defects.js`)
   - `fetchDefects()` - Fetches all defects from Supabase with optional filters
   - `updateDefectStatus()` - Updates status of a defect (pending → reviewed → resolved)
   - `createDefect()` - Creates a new defect record
   - Handles error cases and provides detailed logging

3. **Supabase Client** (`Frontend/src/supabase.js`)
   - Initializes the Supabase client using credentials from `.env.local`
   - Exports the `supabase` object for use in services

## Troubleshooting

### No Defects Appearing
1. **Check Browser Console**
   - Look for `✅ Supabase initialized successfully` message
   - Check for any fetch errors starting with `[fetchDefects]` or `[Dashboard]`

2. **Verify Environment Variables**
   - Ensure `.env.local` exists in the `Frontend/` directory
   - Check that `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` are set
   - Restart the dev server after creating/modifying `.env.local`

3. **Check Supabase Dashboard**
   - Verify the `defects` table exists
   - Check if there are any defect records in the table
   - Verify Row Level Security (RLS) policies allow anonymous reads (if enabled)

4. **Network Issues**
   - Check that Supabase URL is accessible
   - Verify CORS is not blocking the request
   - Check browser DevTools → Network tab for failed requests

### Table Not Found Error
- Error message: `"defects" table does not exist`
- Solution: Create the `defects` table using the schema provided above
- Go to Supabase Dashboard → SQL Editor → Run the CREATE TABLE query

### Authentication Errors
- The app uses the anon key for read access
- Ensure RLS policies allow reads with the anon key:
  ```sql
  ALTER TABLE defects ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Allow public read" ON defects 
    FOR SELECT USING (true);
  ```

### Defects List Shows "No Detections Yet"
- This is normal on first load if no defects exist
- The dashboard will show defects that were created after the session started
- To test, create a test defect record in Supabase:
  ```sql
  INSERT INTO defects (device_id, defect_type, detected_at, image_url, status)
  VALUES ('CAM-001', 'crack', CURRENT_TIMESTAMP, 'https://example.com/image.jpg', 'pending');
  ```

## Performance Notes

- Defects are fetched every 3 seconds (configurable in Dashboard.js)
- The list keeps the latest 20 defects to avoid memory issues
- Scroll position is preserved during updates
- Modal tracking uses defect ID instead of array index for stability

## Testing

To verify the setup is working:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for logs starting with `[Dashboard]` and `[fetchDefects]`
4. You should see successful fetch messages with defect counts
5. Add a test record to Supabase and verify it appears in the list within 3 seconds
