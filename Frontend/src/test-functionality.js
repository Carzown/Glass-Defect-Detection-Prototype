/**
 * COMPREHENSIVE FUNCTIONALITY TEST
 * Tests: Backend, Frontend, Database, WebSocket connections
 * Run this in browser console to verify all systems are operational
 */

const TESTS = {
  backend: false,
  websocket: false,
  supabase: false,
  login: false,
  defects: false,
  modal: false,
};

const RESULTS = [];

// ==========================================
// 1. TEST BACKEND CONNECTIVITY
// ==========================================
async function testBackendConnectivity() {
  try {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://glass-defect-detection-prototype-production.up.railway.app';
    const response = await fetch(`${backendUrl}/health`, { timeout: 5000 });
    
    if (response.ok) {
      TESTS.backend = true;
      RESULTS.push('✅ BACKEND: Connected to Railway');
      console.log('✅ Backend is responsive');
    } else {
      RESULTS.push(`⚠️ BACKEND: Connected but returned ${response.status}`);
    }
  } catch (error) {
    RESULTS.push(`❌ BACKEND: ${error.message}`);
    console.error('❌ Backend not reachable:', error);
  }
}

// ==========================================
// 2. TEST WEBSOCKET CONNECTION
// ==========================================
async function testWebSocketConnection() {
  return new Promise((resolve) => {
    try {
      const wsUrl = process.env.REACT_APP_WS_URL || 'wss://glass-defect-detection-prototype-production.up.railway.app/ws';
      const ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        ws.close();
        RESULTS.push('⚠️ WEBSOCKET: Connection timeout');
        TESTS.websocket = false;
        resolve();
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        TESTS.websocket = true;
        RESULTS.push('✅ WEBSOCKET: Connected to Railway backend');
        console.log('✅ WebSocket is connected');
        
        // Send registration message
        ws.send(JSON.stringify({
          type: 'register',
          client_type: 'web_client'
        }));
        
        ws.close();
        resolve();
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        RESULTS.push(`❌ WEBSOCKET: ${error.message || 'Connection error'}`);
        console.error('❌ WebSocket error:', error);
        resolve();
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        resolve();
      };
    } catch (error) {
      RESULTS.push(`❌ WEBSOCKET: ${error.message}`);
      console.error('❌ WebSocket error:', error);
      resolve();
    }
  });
}

// ==========================================
// 3. TEST SUPABASE CONNECTION
// ==========================================
async function testSupabaseConnection() {
  try {
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      RESULTS.push('❌ SUPABASE: Missing environment variables');
      return;
    }

    // Check if Supabase client is initialized
    const response = await fetch(`${supabaseUrl}/rest/v1/defects?limit=1`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      timeout: 5000,
    });

    if (response.status === 200 || response.status === 401) {
      TESTS.supabase = true;
      RESULTS.push('✅ SUPABASE: Connected to database');
      console.log('✅ Supabase connection working');
    } else {
      RESULTS.push(`⚠️ SUPABASE: Status ${response.status}`);
    }
  } catch (error) {
    RESULTS.push(`❌ SUPABASE: ${error.message}`);
    console.error('❌ Supabase error:', error);
  }
}

// ==========================================
// 4. TEST LOGIN STATUS
// ==========================================
function testLoginStatus() {
  const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
  const userId = sessionStorage.getItem('userId');
  const role = sessionStorage.getItem('role');

  if (loggedIn && userId) {
    TESTS.login = true;
    RESULTS.push(`✅ LOGIN: User authenticated (Role: ${role || 'employee'})`);
  } else {
    RESULTS.push('⚠️ LOGIN: User not authenticated - Login required');
  }
}

// ==========================================
// 5. TEST DEFECTS LOADING
// ==========================================
async function testDefectsLoading() {
  try {
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/rest/v1/defects?select=*&limit=5&order=detected_at.desc`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      timeout: 5000,
    });

    const data = await response.json();

    if (Array.isArray(data)) {
      TESTS.defects = true;
      RESULTS.push(`✅ DEFECTS: Loaded ${data.length} defects from database`);
      if (data.length > 0) {
        RESULTS.push(`   Latest: ${data[0].defect_type} @ ${new Date(data[0].detected_at).toLocaleString()}`);
      }
    } else {
      RESULTS.push('⚠️ DEFECTS: Unable to load defects');
    }
  } catch (error) {
    RESULTS.push(`❌ DEFECTS: ${error.message}`);
    console.error('❌ Defects error:', error);
  }
}

// ==========================================
// 6. CHECK ENVIRONMENT VARIABLES
// ==========================================
function testEnvironmentVariables() {
  RESULTS.push('\n📝 ENVIRONMENT VARIABLES:');
  RESULTS.push(`   REACT_APP_BACKEND_URL: ${process.env.REACT_APP_BACKEND_URL ? '✅ Set' : '❌ Missing'}`);
  RESULTS.push(`   REACT_APP_WS_URL: ${process.env.REACT_APP_WS_URL ? '✅ Set' : '❌ Missing'}`);
  RESULTS.push(`   REACT_APP_SUPABASE_URL: ${process.env.REACT_APP_SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  RESULTS.push(`   REACT_APP_SUPABASE_ANON_KEY: ${process.env.REACT_APP_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
}

// ==========================================
// RUN ALL TESTS
// ==========================================
async function runAllTests() {
  console.clear();
  console.log('🔍 STARTING COMPREHENSIVE FUNCTIONALITY TEST...\n');

  testEnvironmentVariables();
  
  await testBackendConnectivity();
  await testWebSocketConnection();
  await testSupabaseConnection();
  testLoginStatus();
  await testDefectsLoading();

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS:');
  console.log('='.repeat(60));
  RESULTS.forEach(result => console.log(result));
  console.log('='.repeat(60));

  // Summary
  const passed = Object.values(TESTS).filter(v => v).length;
  const total = Object.keys(TESTS).length;
  console.log(`\n📊 SUMMARY: ${passed}/${total} systems operational\n`);

  if (passed === total) {
    console.log('✅ ALL SYSTEMS GO! Your app is fully functional.');
  } else {
    console.log('⚠️ Some systems need attention. Check details above.');
  }
}

// Export for use
window.runAllTests = runAllTests;

// Auto-run on load
console.log('Test suite loaded. Run: runAllTests()');
