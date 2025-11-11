# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Supabase Defects Integration

The Dashboard can show live defects inserted by the Supabase Edge Function `defects-upload`.

1. Create a `.env.local` (or copy `.env.example`) with:

```
REACT_APP_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
REACT_APP_ENABLE_SUPABASE_REALTIME=true
REACT_APP_BACKEND_URL=http://localhost:5000
```

2. Ensure the SQL in `supabase/sql/defects.sql` is applied and Realtime is enabled (`defects` table added to publication).

3. Deploy / run the `supabase/functions/defects-upload` edge function and send multipart form-data with `file`, `defect_type`, `device_id`.

4. Click `Start Detection` on the Dashboard to set a session start marker; all defects inserted after that time appear. If you want defects immediately without clicking Start, set:

```
REACT_APP_AUTO_SUBSCRIBE_ON_LOAD=true
```

5. Images: if using a public bucket (`defects`), the `image_url` returned will render directly. If private, adjust the edge function to issue signed URLs (`USE_SIGNED_URLS=true`).

Troubleshooting:
- No defects appearing: verify env vars loaded (check browser console for Supabase warnings).
- Realtime not firing: confirm `supabase_realtime` publication includes `public.defects` and your API key has RLS read access.
- Mixed Socket.IO defects & Supabase: when realtime is enabled, Socket.IO defect array in frames is ignored (source of truth becomes Supabase rows).

## Admin: Manage Users

The Admin page can list users and set passwords via the backend Admin API.

Env required in React (`.env.local`):

```
REACT_APP_BACKEND_URL=http://localhost:5000
```

Backend env (in server environment):

```
SUPABASE_URL=...                     # your project URL
SUPABASE_SERVICE_ROLE_KEY=...        # service role key (keep secret)
ADMIN_API_TOKEN=...                  # random secret; paste this into the Admin page token input
```

Usage:
1. Start backend and React app.
2. In the Admin page, paste the ADMIN_API_TOKEN and click "Refresh Users".
3. To change a password, enter a new password (min 8 chars) and click Set.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Development Convenience: Auto Backend Start

When you click `Start Detection` on the Dashboard in development, the React dev server calls `GET /__start_backend` (provided by `src/setupProxy.js`). This spawns `node backend/server.js` if it is not already running, and proxies Socket.IO traffic through the React dev server. Intended only for local development; avoid in production builds.

Disable by removing or editing `src/setupProxy.js`.
