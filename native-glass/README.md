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

## Using the bundled YOLOv11 small model (.pt/.ptl)

On-device inference for a PyTorch `.pt` model requires the `react-native-pytorch-core` native module and bundling your TorchScript model with the app. In Expo, this needs a Development Build (dev client) and a prebuild step.

High-level steps:

1) Convert your PyTorch model to a TorchScript mobile-compatible file if not already.

    - If you have an Ultralytics YOLOv11 model (e.g., `yolov11s.pt`), export to TorchScript first:

       ```powershell
       pip install ultralytics
       yolo export model=yolov11s.pt format=torchscript imgsz=640
       ```

    - Then convert TorchScript to Mobile Lite (.ptl) for better compatibility on React Native:

       ```powershell
       # From native-glass/
       pip install torch torchvision
       python scripts/verify_and_convert_torchscript.py ../yolov11_small_model.pt
       # Produces ../yolov11_small_model.ptl next to the original file
       ```

2) Add the native module (requires a dev build):

   ```bash
   npm install react-native-pytorch-core
   npx expo prebuild
   npx expo run:android  # or run:ios
   ```

3) Bundle the model with the app or provide a path at runtime:

- Recommended: place the model at `native-glass/yolov11_small_model.ptl` (preferred) or `.pt` and the app will load it automatically (see `services/ml.ts`). Metro is configured to bundle both `.pt` and `.ptl` (see `metro.config.js`).
- Alternatively, set `MODEL_PATH` in `app.json > expo.extra` to an absolute file path on the device (e.g., downloaded at runtime) and the app will attempt to load it.

4) Implement preprocessing/postprocessing:

`services/ml.ts` contains the scaffold to load a model and run detection. You'll need to:

- Convert the `base64` camera frame into the tensor input your model expects.
- Run inference via `torch.Module` API.
- Parse model output into `{ x, y, width, height, score, label }` values normalized to 0–1 to draw boxes.

Until the native module and model are wired, the app falls back gracefully with no on-device boxes, while still allowing optional uploads to your Edge flow. When a `.ptl` is present, the app prefers it automatically.

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
