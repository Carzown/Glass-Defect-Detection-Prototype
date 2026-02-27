# Glass Defect Detection Prototype - Quick Start Guide

## 🚀 Live Application

**Frontend (GitHub Pages):** https://Carzown.github.io/Glass-Defect-Detection-Prototype/

**Backend (Railway):** https://glass-defect-detection-prototype-production.up.railway.app

**Database (Supabase):** PostgreSQL with 300+ glass defect records

---

## 📋 Test Account Credentials

Use these credentials to log in and test the application:

### Employee Accounts

| Email | Password | Role |
|-------|----------|------|
| `grodionahoa@pu.edu.ph` | `TestUser123!` | Employee |
| `qp-pancela@ps.edu.ph` | `TestUser123!` | Employee |
| `demo.employee@test.com` | `DemoPass123!` | Employee |

### Admin Accounts

| Email | Password | Role |
|-------|----------|------|
| `demo.admin@test.com` | `DemoAdmin123!` | Admin |
| `carson.clarito22@gmail.com` | `Admin123!` | Admin |

---

## 🔑 Login Steps

1. Visit: https://Carzown.github.io/Glass-Defect-Detection-Prototype/
2. Select **Employee** or **Admin** tab
3. Enter email and password from the table above
4. Click **Sign In**
5. Check **"Remember me"** if desired (saves email locally)

---

## ✨ Key Features

### 👥 Employee Dashboard
- View glass defect detection history
- Filter by date range
- Export defect reports
- Access to "How to Use" guides

### 👨‍💼 Admin Dashboard
- Full defect management (view, edit, delete)
- Employee account management
- Advanced analytics and statistics
- Device status monitoring
- Detection quality metrics by defect type

---

## 🛠️ Technology Stack

| Component | Technology | Status |
|-----------|-----------|--------|
| Frontend | React 18.3.1 + React Router 7.10.0 | ✅ Live |
| Backend | Node.js 20 + Express.js | ✅ Live |
| Database | Supabase (PostgreSQL) | ✅ Connected |
| Auth | Supabase Authentication | ✅ Working |
| Storage | Supabase Storage (Image URLs) | ✅ Configured |
| Deploy Frontend | GitHub Pages | ✅ Deployed |
| Deploy Backend | Railway | ✅ Deployed |

---

## 🔧 Local Development

### Prerequisites
- Node.js 18+ and npm
- Git
- `.env` files with Supabase credentials

### Setup Backend

```bash
cd Backend
npm install
node setup-test-users.js    # Create test users in Supabase
npm start                   # Start on http://localhost:5000
```

### Setup Frontend

```bash
cd Frontend
npm install
npm start                   # Start on http://localhost:3000
```

### Build & Deploy

**Frontend to GitHub Pages:**
```bash
cd Frontend
npm run build
npm run deploy              # Builds then pushes to gh-pages branch
```

**Backend to Railway:**
Simply push to GitHub - Railway's CI/CD automatically deploys.

---

## 📊 System Architecture

```
┌─────────────────────────────────────────┐
│   Browser (GitHub Pages)                │
│   https://Carzown.github.io/...         │
└──────────────┬──────────────────────────┘
               │
               │ HTTPS API calls
               ▼
┌─────────────────────────────────────────┐
│   Backend (Railway)                     │
│   https://...up.railway.app             │
│   - Express.js REST API                 │
│   - Authentication routing              │
│   - Data aggregation                    │
└──────────────┬──────────────────────────┘
               │
               │ Supabase Client
               ▼
┌─────────────────────────────────────────┐
│   Supabase (PostgreSQL DB)              │
│   - User Auth (email/password)          │
│   - Defect records (300+)               │
│   - User profiles & permissions         │
│   - Image storage (signed URLs)         │
└─────────────────────────────────────────┘
```

---

## 🔒 Security Notes

- ✅ **No hardcoded secrets** - All env vars validated
- ✅ **CORS properly configured** - GitHub Pages and Railway domains whitelisted
- ✅ **Service role key protected** - Only in backend .env
- ✅ **Anon key exposed** - Public (Supabase by design)
- ⚠️ **Test users for demo only** - Change passwords in production

---

## 🚨 Troubleshooting

### "Cannot reach the server"

- ✅ **FIXED** - Frontend now correctly connects to Railway backend
- Removed fallback to `window.location.origin` (was causing issues on GitHub Pages)
- Frontend explicitly uses `REACT_APP_BACKEND_URL` from .env

### Login credentials not working

- Test users may not exist yet
- Run: `node Backend/setup-test-users.js` to create them
- Check browser DevTools Console for detailed error messages

### CORS errors

- Backend CORS is configured for GitHub Pages URL
- Ensure you're using the live URLs, not localhost

### Defect data not showing

- Check backend is running and connected to Supabase
- Test endpoint: https://glass-defect-detection-prototype-production.up.railway.app/health

---

## 📝 Recent Fixes (Session 2)

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Login fails for all users | Frontend redirecting to `Carzown.github.io/auth/login` instead of Railway backend | Changed URL detection to use explicit `REACT_APP_BACKEND_URL` |
| No test users in system | Users not created in Supabase Auth | Added `setup-test-users.js` script |
| Multiple React Router versions | Conflicting dependencies | Resolved (React Router 7.10.0) |
| CORS rejections | GitHub Pages origin not whitelisted | Added to CORS whitelist in server.js |

---

## 📞 Support

For issues or questions:
1. Check the browser console (F12) for error details
2. Verify .env files have correct Supabase credentials
3. Test backend connectivity: `curl https://glass-defect-detection-prototype-production.up.railway.app/health`
4. Check Git logs for recent deployment changes

---

## 🎯 Next Steps for Production

- [ ] Set up proper email verification for new user signups
- [ ] Implement password reset functionality
- [ ] Add SSL certificate monitoring
- [ ] Set up error logging and monitoring
- [ ] Create admin user management UI
- [ ] Implement audit logs for data changes
- [ ] Add rate limiting to auth endpoints
- [ ] Enable 2FA for admin accounts

---

**Last Updated:** February 27, 2026  
**Status:** ✅ All systems operational
