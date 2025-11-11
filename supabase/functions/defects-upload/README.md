# defects-upload (Supabase Edge Function)

Accepts `multipart/form-data` and:
- Validates `X-Device-Token` against `DEVICE_INGEST_TOKEN`
- Uploads the `file` to the Storage bucket (default `defects`)
- Inserts a row into `public.defects`
- Returns `{ ok: true, defect }`

## Deploy

1) Create schema and policies (one-time):
- Open Supabase SQL Editor and run `supabase/sql/defects.sql` (or use CLI)

2) Create and deploy function:
- Place this folder at `supabase/functions/defects-upload`
- In your Supabase project, deploy with the Supabase CLI

3) Set function secrets (environment variables):

Dashboard (recommended):
- Go to Project Settings → Functions → Environment Variables and set:
	- SUPABASE_URL = https://<project-ref>.supabase.co
	- SUPABASE_SERVICE_ROLE_KEY = <your service role key>
	- DEVICE_INGEST_TOKEN = <generate a strong random token, share to device>
	- BUCKET = defects (optional; defaults to `defects`)
	- USE_SIGNED_URLS = false (or true if you want signed URLs)
	- SIGNED_URL_EXPIRES = 86400 (optional)

CLI alternative:
```
supabase functions secrets set SUPABASE_URL="https://<project-ref>.supabase.co"
supabase functions secrets set SUPABASE_SERVICE_ROLE_KEY="<service-role>"
supabase functions secrets set DEVICE_INGEST_TOKEN="<strong-random-token>"
supabase functions secrets set BUCKET="defects"
supabase functions secrets set USE_SIGNED_URLS="false"
supabase functions secrets set SIGNED_URL_EXPIRES="86400"
```

Function URL will be:
https://<project-ref>.functions.supabase.co/defects-upload

## Request contract

Inputs (multipart/form-data):
- file: image (jpeg/png)
- defect_type: text (e.g., "Crack")
- device_id: text (e.g., "cam-1")
- time_text: optional display string (e.g., "[12:03:45]")

Headers:
- x-device-token: must match `DEVICE_INGEST_TOKEN`

Response:
- 200: `{ ok: true, defect: { id, defect_type, image_url, time_text, device_id, created_at } }`
- 4xx/5xx: `{ ok: false, error: "..." }`

## Storage access

- If `USE_SIGNED_URLS` is false (default), bucket `defects` should be public read or the URL must be accessible by the website.
- If `USE_SIGNED_URLS` is true, a signed URL is generated for each insert.

## Smoke test (optional)

Use the included Python script to validate the function before plugging in the Jetson:

Requirements: `pip install requests`

PowerShell example:

```
$env:FUNCTION_URL="https://<project-ref>.functions.supabase.co/defects-upload"
$env:DEVICE_TOKEN="<DEVICE_INGEST_TOKEN>"
$env:DEVICE_ID="cam-1"
$env:IMAGE_PATH="C:\\path\\to\\sample.jpg"
python smoke_test.py
```

You should see `HTTP 200 { ok: true, defect: ... }` and the row will appear in the Dashboard (Realtime) if it’s running.

## Notes

- The dashboard already listens to Supabase Realtime on `public.defects`; once this function inserts the row, it will appear live.
- The Jetson example client posts to this function and includes `time_text` to match the UI format.
