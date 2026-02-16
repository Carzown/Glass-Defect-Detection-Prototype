# ✅ System Functionality Checklist

## Production Domain: `glass-defect-detection-prototype-production.up.railway.app`
**WebSocket URL:** `wss://glass-defect-detection-prototype-production.up.railway.app:8080`

---

## **PART 1: QtApp (Desktop Application) - 12 Tests**

### **A. Build & Compilation (3 tests)**
- [ ] **Test 1.A.1** - Open QtApp in Qt Creator
- [ ] **Test 1.A.2** - Build project with `Ctrl+B` (should compile without errors)
- [ ] **Test 1.A.3** - No linker errors, executable created in `/build` folder

### **B. WebSocket Configuration (3 tests)**
- [ ] **Test 1.B.1** - Open `mainwindow.cpp` - verify line 28 has: `wss://glass-defect-detection-prototype-production.up.railway.app:8080`
- [ ] **Test 1.B.2** - Open `websockethandler.h` - verify line 15 default parameter is production domain
- [ ] **Test 1.B.3** - No hardcoded `localhost:8080` or `192.168.x.x:8080` URLs remaining

### **C. Runtime Connection (3 tests)**
- [ ] **Test 1.C.1** - Run QtApp with `Ctrl+R`
- [ ] **Test 1.C.2** - Check console output for: `Connected to wss://glass-defect-detection-prototype-production.up.railway.app:8080` or `WebSocket connected`
- [ ] **Test 1.C.3** - GUI displays without crashes, defect list visible and ready

### **D. Data Flow (3 tests)**
- [ ] **Test 1.D.1** - Simulate frame capture (if test data available)
- [ ] **Test 1.D.2** - Verify defects appear in defect list widget
- [ ] **Test 1.D.3** - Check that confidence % and image badge display correctly

---

## **PART 2: Frontend (React Dashboard) - 11 Tests**

### **A. File Configuration (3 tests)**
- [ ] **Test 2.A.1** - `Frontend/.env.production` exists
- [ ] **Test 2.A.2** - File contains: `REACT_APP_WS_URL=wss://glass-defect-detection-prototype-production.up.railway.app:8080`
- [ ] **Test 2.A.3** - File contains: `REACT_APP_BACKEND_URL=https://glass-defect-detection-prototype-production.up.railway.app`

### **B. Build & Dependencies (2 tests)**
- [ ] **Test 2.B.1** - Run `npm install` in Frontend folder (no errors)
- [ ] **Test 2.B.2** - Build with `npm run build` (creates optimized build folder)

### **C. Local Development (2 tests)**
- [ ] **Test 2.C.1** - Run `npm start` in Frontend
- [ ] **Test 2.C.2** - Dashboard loads at `http://localhost:3000` (or assigned port)

### **D. WebSocket Connection (2 tests)**
- [ ] **Test 2.D.1** - Open browser DevTools Console (F12)
- [ ] **Test 2.D.2** - Check for: `WebSocket connected to wss://glass-defect-detection-prototype-production.up.railway.app:8080` (no connection errors)

### **E. UI & Features (2 tests)**
- [ ] **Test 2.E.1** - Login page loads with Supabase auth
- [ ] **Test 2.E.2** - Dashboard displays defect list, camera stream area, and status indicators

---

## **PART 3: Integration Tests - 6 Tests**

### **A. Backend Connection (2 tests)**
- [ ] **Test 3.A.1** - Backend is running on Railway at `glass-defect-detection-prototype-production.up.railway.app` with status "Online" in Railway dashboard
- [ ] **Test 3.A.2** - WebSocket port 8080 is exposed and accepting connections

### **B. End-to-End (2 tests)**
- [ ] **Test 3.B.1** - Qt App connects to production backend → inspect Railway logs for incoming connection
- [ ] **Test 3.B.2** - Frontend connects to production backend → no CORS errors in browser console

### **C. Defect Flow (2 tests)**
- [ ] **Test 3.C.1** - When defect detected on Pi → appears in Qt App list within 2 seconds
- [ ] **Test 3.C.2** - When defect detected → appears in Frontend dashboard within 3 seconds

---

## **PART 4: Deployment Readiness - 5 Tests**

### **A. Code Quality (2 tests)**
- [ ] **Test 4.A.1** - No debug print statements or console.logs in production code
- [ ] **Test 4.A.2** - All credentials are environment variables, no hardcoded API keys

### **B. Documentation (2 tests)**
- [ ] **Test 4.B.1** - README files updated with production URLs
- [ ] **Test 4.B.2** - Environment variable setup documented for deployment

### **C. Final Check (1 test)**
- [ ] **Test 4.C.1** - All files committed and ready to push (run `git status` - should show no uncomitted changes)

---

## **SUMMARY**

**Total Tests:** 35

### **Quick Pass/Fail:**
- ✅ **All QtApp tests pass (12/12)** = Desktop app production-ready
- ✅ **All Frontend tests pass (11/11)** = Web dashboard production-ready  
- ✅ **All Integration tests pass (6/6)** = System communicates end-to-end
- ✅ **All Deployment tests pass (5/5)** = Ready to ship

**Status:** 🟢 **PRODUCTION READY** (when 35/35 pass)

---

## **Commands to Run Tests**

```bash
# Part 1: QtApp
cd QtApp
cmake -B build
cmake --build build
./build/Defect  # Run the app

# Part 2: Frontend
cd Frontend
npm install
npm start  # For local testing
npm run build  # For production build

# Part 3 & 4: Verification
git status  # Should be clean
git log --oneline  # Verify commits
```

---

## **If Any Test Fails:**

1. **QtApp WebSocket connection fails?**
   - Verify Railway backend is "Online" in dashboard
   - Check Qt Creator debug output for exact error

2. **Frontend shows CORS errors?**
   - Backend must be running with CORS headers
   - Check `backend/server.js` has proper CORS configuration

3. **Defects not appearing?**
   - Check Supabase connection is working
   - Verify database table `defects` exists and has data

---

**Ready to run the checklist?** ✅
