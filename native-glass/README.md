# Native Glass (Expo) — Camera + Defect Detection

This is an [Expo](https://expo.dev) app for live defect monitoring using the phone's camera, with an option to run on-device inference (PyTorch) or log detections to Supabase via the existing Edge upload.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment variables

   Copy `.env.example` to `.env` and set values (Supabase URL/key, Edge upload, optional cloud inference). These are read via `app.json > expo.extra`.

3. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development [tsconfig.json](tsconfig.json)build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Live camera detection in Dashboard

- The Dashboard screen now uses the phone camera for a live preview and runs a detection loop that captures frames periodically and overlays bounding boxes.
- Detected defects are appended to the list below the preview. If Supabase Realtime is enabled, the app also subscribes to `public.defects` to reflect detections inserted by your Edge function.

### Camera permissions

The app requests camera permission on first use. On iOS, an Info.plist description is included.

## On-device inference removed

This repository no longer includes on-device PyTorch inference or bundled TorchScript models. The previous workflow relied on `react-native-pytorch-core` and prebuilt model assets; those parts have been removed to simplify building and distributing the Expo app.

Current behavior:

- The app uses a simulated detection result for Expo Go and when no cloud inference endpoint is configured.
- Optional cloud inference is supported via `CLOUD_INFERENCE_URL` / `CLOUD_INFERENCE_TOKEN` in `app.json > expo.extra` and will be used when provided.

If you want to re-enable on-device inference in the future, you'll need to:

1. Add `react-native-pytorch-core` back to `package.json` and prebuild a development client with native modules.
2. Provide a TorchScript/mobile model file and configure Metro/asset bundling accordingly.
3. Restore or implement model conversion scripts in `scripts/` and ensure PyTorch is installed in a suitable Python environment.

### Development Build (Dev Client) on Android (Windows)

```powershell
# From native-glass/
npm install
npx expo prebuild
npx expo run:android
```

Open the app → Dashboard → Start Detection. You should see green boxes and the defects list updating if the model is valid TorchScript.

## Deployments and updates

This app can be built and distributed independently using EAS Build and Updates.

1) Build a Dev Client for internal testing (APK):

```powershell
# From native-glass/
npm run build:dev
```

2) Production build for Play Store / App Store:

```powershell
# Android AAB (recommended)
npm run build:android

# iOS build (requires Apple credentials)
npm run build:ios
```

3) Submit to stores (after successful builds):

```powershell
npm run submit:android
npm run submit:ios
```

4) Over-the-air (OTA) updates (requires a compatible Dev/Store client already installed):

```powershell
# Push a preview update to the 'preview' branch
npm run update:preview

# Push a production update to the 'production' branch
npm run update:production
```

Notes:
- The on-device model (`yolov11_small_model.ptl`) is bundled with the app. OTA updates do not replace native assets; to ship a new model, make a new build.
- For web publishing, PyTorch native does not run. Set `CLOUD_INFERENCE_URL` to enable cloud detection when running in Expo Go or on the web.

## Environment

Configure the following in `app.json > expo.extra` or your `.env` used by the Expo config:

- `SUPABASE_URL` / `SUPABASE_ANON_KEY`
- `BACKEND_URL` (optional; not required for camera mode)
- `ENABLE_SUPABASE_REALTIME` (default true)
- `EDGE_UPLOAD_URL` and `DEVICE_INGEST_TOKEN` (for manual image upload button on the Dashboard)
- `CLOUD_INFERENCE_URL` and `CLOUD_INFERENCE_TOKEN` (optional) to enable detections in Expo Go via a remote API returning `{ boxes: [...] }`
   - Optional: `CLOUD_INFERENCE_MIN_INTERVAL_MS` (default 1200) to throttle requests

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
