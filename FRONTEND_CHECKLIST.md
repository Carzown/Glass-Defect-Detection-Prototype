# Frontend Functionality Checklist

## 📋 Complete Testing Guide for Frontend Application

**Last Updated**: February 16, 2026  
**Status**: ✅ Ready for Testing  
**Environment**: React + Supabase + WebSocket

---

## Section 1: Authentication (Login & Logout)

### Login Page Load
- [ ] Login page loads without errors
- [ ] Email/username input field is visible and editable
- [ ] Password input field is visible and masked
- [ ] Login button is visible and clickable
- [ ] "Remember me" checkbox is visible
- [ ] Links to signup/forgot password are visible (if implemented)

### Login Functionality
- [ ] Valid credentials successfully log in user
- [ ] User redirected to dashboard after successful login
- [ ] Invalid email shows error message
- [ ] Invalid password shows error message
- [ ] Empty email field shows validation error
- [ ] Empty password field shows validation error
- [ ] "Remember me" checkbox persists email in localStorage
- [ ] "Remember me" unchecked clears email from localStorage
- [ ] Session is stored in sessionStorage (loggedIn, role, userId)
- [ ] User role (admin/employee) is correctly stored

### Logout Functionality
- [ ] Logout button is visible on dashboard
- [ ] Logout button successfully signs out user
- [ ] Logout redirects to login page
- [ ] Session storage is cleared (loggedIn, role, userId removed)
- [ ] Email is cleared from localStorage (if Remember me unchecked)
- [ ] Email remains in localStorage (if Remember me was checked)
- [ ] User cannot access dashboard after logout without re-entering credentials

---

## Section 2: Supabase Connection & Polling

### Initial Connection
- [ ] Supabase client initializes successfully
- [ ] Connection uses correct REACT_APP_SUPABASE_URL from .env.production
- [ ] Connection uses correct REACT_APP_SUPABASE_ANON_KEY from .env.production
- [ ] No CORS errors in console
- [ ] No authentication errors in console

### Defect List Polling
- [ ] Polling starts every 3 seconds after component mount
- [ ] Polling fetches defects from Supabase database
- [ ] New defects appear in list within ~3 seconds
- [ ] Defect list updates without page reload
- [ ] Console shows no polling errors
- [ ] Polling continues running while on dashboard
- [ ] Polling stops when component unmounts (no memory leaks)
- [ ] No duplicate defects in list (deduplication works)

### Defect Data Retrieval
- [ ] Fetched defects include: id, defect_type, detected_at, image_url, status, confidence
- [ ] Defects sorted by detected_at (latest first)
- [ ] Latest 20 defects shown in list
- [ ] Old defects after 20 are not displayed
- [ ] Session start time is tracked correctly
- [ ] Only defects detected after login are shown (time filtering works)

### Error Handling
- [ ] If Supabase connection fails, error is logged to console
- [ ] Dashboard still displays even if initial fetch fails
- [ ] Retry is attempted after error
- [ ] User sees appropriate error message (if implemented)

---

## Section 3: WebSocket Connection & Live Streaming

### WebSocket Connection Setup
- [ ] WebSocket connects on component mount
- [ ] Uses correct REACT_APP_WS_URL: `wss://glass-defect-detection-prototype-production.up.railway.app:8080`
- [ ] Console shows "WebSocket connected" message
- [ ] Connection status changes to "connected"
- [ ] No security warnings in console
- [ ] WSS (secure) protocol is used (not WS)

### Frame Streaming
- [ ] WebSocket receives frame data (base64 JPEG)
- [ ] Live frames display in video element
- [ ] Frames update in real-time (< 1 second latency)
- [ ] Frame data structure: `{ type: 'frame', frame: 'base64string' }`
- [ ] Old frame URL is revoked (memory cleanup)
- [ ] No memory leaks from continuous frame updates

### Defect Detection via WebSocket
- [ ] WebSocket receives defect data from backend
- [ ] Defect data structure: `{ type: 'defect', defect: { id, type, confidence, image_url } }`
- [ ] New defects immediately appear in list (no 3s delay)
- [ ] Real-time defects are prioritized (shown first)
- [ ] Confidence percentage displays correctly
- [ ] Defect type is capitalized correctly

### Connection Stability
- [ ] Connection remains active while on dashboard
- [ ] If connection drops, auto-reconnects after 3 seconds
- [ ] Reconnection is logged to console
- [ ] Status updates to "connected" after successful reconnection
- [ ] Multiple reconnections don't cause duplicates
- [ ] Manual connection test works (if implemented)

### Error Handling
- [ ] Connection errors are logged to console
- [ ] Stream status shows "error" on connection failure
- [ ] Camera error message displays appropriate text
- [ ] System attempts automatic reconnection
- [ ] User can manually reconnect (if button implemented)

---

## Section 4: Defect List Display

### List Rendering
- [ ] Defect list displays all fetched defects
- [ ] Each defect shows: time, type, image badge, confidence %
- [ ] List is scrollable (if more than 20 defects)
- [ ] Defects sorted with latest first
- [ ] List updates without flickering
- [ ] No console errors during rendering

### Defect Item Format
- [ ] Time displayed in HH:MM:SS format
- [ ] Defect type capitalized (e.g., "Broken" not "broken")
- [ ] Confidence shown as percentage (e.g., "85%" not "0.85")
- [ ] Image badge shows "● Image" if image available
- [ ] Image badge shows "◯ Image" if no image
- [ ] Clickable item opens modal (if implemented)

### Scroll Position
- [ ] Scroll position maintained during polling updates
- [ ] New defects added without scrolling to top
- [ ] Scroll position restored after state update
- [ ] requestAnimationFrame used for smooth scroll restoration
- [ ] No scroll jumps or flicker

### Defect Deduplication
- [ ] Same defect doesn't appear twice in list
- [ ] Supabase and WebSocket defects are merged properly
- [ ] Latest data overwrites older data for same defect ID
- [ ] No duplicate IDs in currentDefects state

---

## Section 5: Defect Modal / Details View

### Modal Open
- [ ] Clicking defect item opens modal (if implemented)
- [ ] Modal displays full defect details
- [ ] Modal overlay is visible and semi-transparent
- [ ] Modal is centered on screen
- [ ] Modal is responsive on mobile

### Modal Content
- [ ] Defect image displays (if available)
- [ ] Image has proper fallback (if no image)
- [ ] Defect type displayed clearly
- [ ] Timestamp in readable format
- [ ] Confidence percentage shown
- [ ] Device ID shown (if available)
- [ ] Status shows current state
- [ ] Additional notes displayed (if available)
- [ ] All Supabase fields displayed correctly

### Modal Interactions
- [ ] Close button (X) closes modal
- [ ] Clicking outside modal closes it (if implemented)
- [ ] Escape key closes modal (if implemented)
- [ ] Status dropdown shows available options
- [ ] Status update button is visible
- [ ] Status update is functional (see Status Updates section)

### Modal Functionality
- [ ] Modal doesn't block background updates
- [ ] Supabase polling continues while modal open
- [ ] WebSocket continues receiving data while modal open
- [ ] If defect data updates, modal reflects changes
- [ ] Notes can be edited (if implemented)

---

## Section 6: Status Updates

### Status Update UI
- [ ] Status dropdown shows available options (pending, investigating, resolved, etc.)
- [ ] Current status is pre-selected in dropdown
- [ ] Update button is visible and clickable
- [ ] Update button is disabled during request
- [ ] Loading indicator shows during update
- [ ] Success message appears after update

### Status Update Functionality
- [ ] Selected status is sent to backend
- [ ] Status updated in Supabase database
- [ ] Local state updates immediately
- [ ] Next polling cycle confirms update
- [ ] Multiple updates can be made without reload
- [ ] Error message displays if update fails
- [ ] Retry option available if failed

### Status Update Error Handling
- [ ] Network error during update is handled
- [ ] User can retry failed status update
- [ ] Previous status restored if update fails
- [ ] Error message is informative

---

## Section 7: Navigation & UI Elements

### Dashboard Layout
- [ ] Header displays correctly with branding
- [ ] Sidebar visible (if implemented) or navigation menu
- [ ] Main content area properly sized
- [ ] Responsive on desktop (1920px+)
- [ ] Responsive on tablet (768px-1024px)
- [ ] Responsive on mobile (< 768px)

### Top Navigation
- [ ] App title/logo visible
- [ ] Logout button in top right (or menu)
- [ ] User info displayed (if implemented)
- [ ] Current page highlighted

### Buttons & Controls
- [ ] All buttons have proper hover effects
- [ ] Buttons have proper focus states for keyboard navigation
- [ ] Disabled buttons appear greyed out
- [ ] Button text is clear and descriptive
- [ ] Loading states show spinner or text change

### Video/Stream Display
- [ ] Video element takes appropriate space
- [ ] Video displays received frames
- [ ] Stream status indicator visible
- [ ] "Unable to load" message if stream fails
- [ ] Manual connection toggle works (if implemented)

---

## Section 8: Environment Variables

### Variable Configuration
- [ ] REACT_APP_BACKEND_URL is set correctly
- [ ] REACT_APP_WS_URL is set correctly
- [ ] REACT_APP_SUPABASE_URL is set correctly
- [ ] REACT_APP_SUPABASE_KEY is set correctly
- [ ] .env.production file exists
- [ ] Variables are not exposed to browser (check Network tab)

### Variable Usage
- [ ] Dashboard.js uses REACT_APP_BACKEND_URL
- [ ] Dashboard.js uses REACT_APP_WS_URL
- [ ] supabase.js uses REACT_APP_SUPABASE_URL
- [ ] supabase.js uses REACT_APP_SUPABASE_KEY
- [ ] Admin.js uses REACT_APP_BACKEND_URL
- [ ] No hardcoded URLs in code
- [ ] Falls back to defaults if env variables missing

---

## Section 9: Error Handling & Edge Cases

### Network Errors
- [ ] App handles no internet connection gracefully
- [ ] Error message shown for failed connections
- [ ] App attempts reconnection automatically
- [ ] No infinite error loops in console

### Edge Cases
- [ ] Empty defect list displays properly
- [ ] Very long defect types display without breaking layout
- [ ] Very long timestamps display correctly
- [ ] Very high confidence values (0.99+) display correctly
- [ ] Image URLs that break display fallback
- [ ] Rapid defects (10+/sec) don't crash app

### Data Edge Cases
- [ ] Null/undefined fields handled safely
- [ ] Missing images don't break UI
- [ ] Missing timestamps handled
- [ ] Invalid confidence values handled (clamped or shown as "N/A")
- [ ] Special characters in defect types handled

---

## Section 10: Performance & Optimization

### Rendering Performance
- [ ] No unnecessary re-renders (check React DevTools)
- [ ] Defect list updates smoothly
- [ ] No lag when receiving frames
- [ ] Scroll performance smooth (60 FPS)
- [ ] Modal opens without delay

### Memory Management
- [ ] Memory usage stable over time
- [ ] No memory leaks during polling
- [ ] Frame URLs properly revoked
- [ ] Old defects removed as new ones added (limit 20)
- [ ] WebSocket cleanup on disconnect
- [ ] Component cleanup on unmount

### Bundle Size
- [ ] Build completes successfully
- [ ] No unused dependencies
- [ ] No console warnings about large libraries
- [ ] Initial load time acceptable (< 3s)

---

## Section 11: Browser Compatibility & Console

### Console Checks
- [ ] No errors in browser console
- [ ] No warnings about deprecated APIs
- [ ] WebSocket messages logged clearly
- [ ] Supabase operations logged
- [ ] No CORS errors
- [ ] No "Uncaught" errors

### Browser Testing
- [ ] Works in Chrome/Chromium
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge
- [ ] Responsive design works on all browsers

### Local Storage & Session
- [ ] localStorage holds email if Remember Me checked
- [ ] sessionStorage holds login info
- [ ] Data persists across page refreshes
- [ ] Data clears on logout
- [ ] No sensitive data in localStorage

---

## Section 12: Integration Tests

### Full User Journey
- [ ] User can log in → see dashboard → see defects → view modal → update status → logout
- [ ] Supabase polling and WebSocket work together
- [ ] Real-time defects appear without waiting for polling
- [ ] Status updates persist after page refresh
- [ ] Logout clears all user data

### Data Consistency
- [ ] Defects from WebSocket match Supabase data (eventually)
- [ ] No conflicting data between sources
- [ ] Timestamps consistent across sources
- [ ] Confidence values match

### Production Endpoints
- [ ] Backend URL points to: glass-defect-detection-prototype-production.up.railway.app
- [ ] WebSocket URL points to: wss://glass-defect-detection-prototype-production.up.railway.app:8080
- [ ] Supabase URL is production URL (kfeztemgrbkfwaicvgnk)
- [ ] All endpoints accessible from Vercel

---

## Section 13: Deployment Readiness

### Code Quality
- [ ] No console.warns (only console.logs for debugging)
- [ ] No commented-out code (clean production code)
- [ ] Consistent code formatting
- [ ] Proper error messages (user-friendly)
- [ ] All TODO comments removed

### Build Verification
- [ ] `npm run build` completes without errors
- [ ] Build completes without warnings
- [ ] Production build size acceptable
- [ ] Source maps generated (if needed)

### Documentation
- [ ] README explains setup
- [ ] Environment variables documented
- [ ] API endpoints documented
- [ ] WebSocket message format documented

---

## Testing Instructions

### To Run Checks:
1. **Start Frontend**: `cd Frontend && npm start`
2. **Use Dashboard**: Click through all sections
3. **Check Console**: Open DevTools → Console tab
4. **Verify WebSocket**: Check Network tab → WS filter
5. **Verify Supabase**: Check Network tab → fetch requests
6. **Test Logout**: Click logout, verify redirect to login
7. **Test Re-login**: Log back in, verify session restored

### Test Data Requirements:
- ✅ At least 5 defects in Supabase
- ✅ Each defect with image_url
- ✅ Defects with confidence 0.75-0.95
- ✅ Various defect types (broken, crack, delamination)

---

## Checklist Legend

- [ ] Not Started
- [x] Completed
- [-] N/A (Not Applicable)
- [!] Blocked (Document issue below)

## Known Issues / Blockers

```
[Document any issues found during testing here]

Issue: [Description]
Impact: [What breaks]
Status: [For Review / In Progress / Resolved]
Solution: [Fix applied]
```

---

## Sign-Off

- **Tester**: _______________
- **Date**: _______________
- **Status**: _______________
- **Notes**: _______________

All checks passed: **YES / NO**

Ready for deployment: **YES / NO**

---

**Last Verified**: February 16, 2026
