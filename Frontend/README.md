# Glass Defect Detection - React Frontend

Modern React dashboard for real-time glass defect detection with Supabase integration.

**Status**: 🟢 Production Ready | **Version**: 1.0 | **Last Updated**: February 16, 2026

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- Supabase project with credentials
- Backend running (Railway.app in production)

### Installation

```bash
# Install dependencies
npm install

# Create .env.local with production variables
cat > .env.local << EOF
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
REACT_APP_BACKEND_URL=https://your-railway-backend.railway.app
EOF

# Start development server
npm start

# Build for production
npm run build
```

---

## 📋 Available Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Run development server on http://localhost:3000 |
| `npm run build` | Create optimized production build |
| `npm test` | Run test suite |
| `npm run eject` | Eject from Create React App (irreversible) |

---

## ✨ Features

### Dashboard
- 🎥 **Live Video Stream** - Real-time camera feed from Raspberry Pi
- 📊 **Defect List** - Latest detections with [HH:MM:SS] Type | Badges format
- 🔍 **Defect Details** - 5-item checklist modal (Image, Time, Type, Link, Confidence)
- ✅ **Review Toggle** - Mark defects as pending/reviewed
- 🔄 **Auto-Refresh** - Supabase polling every 3 seconds

### Authentication
- 🔐 **Supabase Auth** - Email/password login
- 💾 **Session Persistence** - Remember login state
- 👤 **User Profile** - View and manage account

### Analytics
- 📊 **Defect Charts** - Visual trends and statistics
- 📈 **Detection History** - Browse and filter past detections
- 🏷️ **Tag Management** - Auto-numbered defect badges

---

## 🏗️ Architecture

```
┌─────────────────┐
│  React Frontend │ (This repo)
│  Dashboard      │
└────────┬────────┘
         │ HTTP API
         │
┌────────▼────────┐
│  Backend API    │
│  (Railway)      │
└────────┬────────┘
         │
    Supabase
    Database + Storage
```

---

## 📁 Project Structure

```
Frontend/
├── public/
│   └── index.html           # Entry point
├── src/
│   ├── pages/
│   │   ├── Dashboard.js     # Main dashboard (655 lines)
│   │   ├── Login.js         # Authentication
│   │   └── Admin.js         # Admin panel
│   ├── components/
│   │   └── Sidebar.js       # Navigation
│   ├── services/
│   │   └── defects.js       # Database queries (cleaned)
│   ├── App.js               # Main app
│   ├── index.js             # React root
│   └── supabase.js          # Supabase client
├── package.json             # Dependencies
└── README.md                # This file
```

---

## 🔧 Environment Variables

### Development (.env.local)
```env
REACT_APP_SUPABASE_URL=http://localhost:3000
REACT_APP_SUPABASE_ANON_KEY=dev_key
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:8080
```

---

## 🧪 Testing

```bash
# Run test suite
npm test

# Run with coverage
npm test -- --coverage

# Build test
npm run build
```

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.2.0 | UI framework |
| react-router-dom | 6.x | Navigation |
| @supabase/supabase-js | Latest | Database client |

---

## 🔐 Security

- ✅ Environment variables for secrets (never commit .env files)
- ✅ Supabase RLS policies enabled
- ✅ CORS configured for production domain
- ✅ API keys properly scoped

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Login not working | Check Supabase credentials in `.env.local` |
| Defects not appearing | Ensure Backend running and connected to Supabase |
| Build fails | Run `rm -rf node_modules package-lock.json` then `npm install` |

---

## 📞 Support

For issues or questions:
1. Check [QUICK_DEPLOYMENT.md](../QUICK_DEPLOYMENT.md) in project root
2. Review [DATABASE_SETUP.sql](../DATABASE_SETUP.sql) for schema
3. Consult [PRODUCTION_VERIFICATION_REPORT.md](../PRODUCTION_VERIFICATION_REPORT.md)

---

## 📄 License

Proprietary - Glass Defect Detection System
