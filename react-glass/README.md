# Glass Defect Detection - React Frontend

A React application for detecting glass defects using a Jetson-based backend with Firebase authentication.

## Available Scripts

### `npm start`
Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm run build`
Builds the app for production to the `build` folder.

### `npm run eject`
**Note: this is a one-way operation.** Ejects from Create React App to have full control over configuration.

## Setup

### Prerequisites
- Node.js 14+ installed
- Firebase project created
- Backend server running on `http://localhost:5000`

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` with Firebase credentials:
```env
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

3. Start the development server:
```bash
npm start
```

## Features

- **Login/Authentication** - Firebase Auth with role-based access (Admin/Employee)
- **Dashboard** - Live detection preview with defect tracking
- **Admin Panel** - User management interface
- **Help Page** - Support and documentation
- **Real-time Updates** - Socket.IO connection for live stream and defects

## Architecture

- **Frontend**: React with Firebase Auth
- **Backend**: Node.js with Socket.IO
- **Database**: Firestore (Firebase)
- **Real-time**: Socket.IO for live streaming

## Roles

- **Admin**: Full access to user management and settings
- **Employee**: Access to dashboard for defect detection monitoring


### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Development Convenience: Auto Backend Start

When you click `Start Detection` on the Dashboard in development, the React dev server calls `GET /__start_backend` (provided by `src/setupProxy.js`). This spawns `node backend/server.js` if it is not already running, and proxies Socket.IO traffic through the React dev server. Intended only for local development; avoid in production builds.

Disable by removing or editing `src/setupProxy.js`.
