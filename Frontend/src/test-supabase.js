// Test utility to verify Supabase connection and data fetching
// Run this in the browser console after the app loads

async function testSupabaseConnection() {
  console.log('🧪 Starting Supabase connection test...\n');

  // Test 1: Check if Supabase is initialized
  console.log('Test 1: Check Supabase initialization');
  try {
    // Import the supabase module (this assumes it's available in window context)
    const response = await fetch('/supabase');
    console.log('✅ Supabase module is available');
  } catch (e) {
    console.log('⚠️  Could not directly test Supabase module, checking via API calls...');
  }

  // Test 2: Try to fetch defects
  console.log('\nTest 2: Fetch defects from Supabase');
  try {
    const result = await window.fetchDefects?.({ limit: 10, offset: 0 }) || 
                   { data: [], error: 'fetchDefects not available' };
    
    if (result.error) {
      console.log(`❌ Error fetching defects: ${result.error}`);
      return;
    }
    
    console.log(`✅ Successfully fetched ${result.data?.length || 0} defects`);
    if (result.data && result.data.length > 0) {
      console.log('Sample defect:', result.data[0]);
    } else {
      console.log('📭 No defects in database (this is normal on first setup)');
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Test 3: Check environment variables
  console.log('\nTest 3: Check environment variables');
  const requiredVars = [
    'REACT_APP_SUPABASE_URL',
    'REACT_APP_SUPABASE_ANON_KEY'
  ];
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      const masked = value.substring(0, 10) + '...';
      console.log(`✅ ${varName}: ${masked}`);
    } else {
      console.log(`❌ ${varName}: NOT SET`);
    }
  });

  console.log('\n🧪 Test complete!');
  console.log('\nTo add a test defect to Supabase:');
  console.log('1. Go to Supabase Dashboard → https://app.supabase.com/');
  console.log('2. Select your project');
  console.log('3. Go to Table Editor → defects table');
  console.log('4. Click "Insert new row"');
  console.log('5. Fill in: device_id=CAM-001, defect_type=crack, detected_at=now, status=pending');
}

// Make the function globally available
window.testSupabaseConnection = testSupabaseConnection;

// Run the test
console.log('💡 Run testSupabaseConnection() to test Supabase setup');
