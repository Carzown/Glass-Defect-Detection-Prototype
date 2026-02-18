// Check the actual Supabase defects table schema
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kfeztemgrbkfwaicvgnk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZXp0ZW1ncmJrZndhaWN2Z25rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwMzg0MiwiZXhwIjoyMDc2Nzc5ODQyfQ.-xhy3SYWYlNiD1d_V264FJ5HyLscmhr_bv5crRcjvK0';

async function checkSchema() {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('📋 Checking defects table schema...\n');
  
  // Fetch one row to see what columns exist
  const { data, error } = await supabaseAdmin
    .from('defects')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ Sample row from defects table:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\n📌 Available columns:');
    Object.keys(data[0]).forEach(col => {
      const val = data[0][col];
      const type = typeof val === 'object' ? 'object' : typeof val;
      console.log(`   - ${col} (${type})`);
    });
  } else {
    console.log('📝 Table is empty - checking schema with SQL...');
    
    // Try to query with all possible columns
    const { data: testData, error: testError } = await supabaseAdmin
      .from('defects')
      .select('*')
      .limit(0);
    
    if (testError) {
      console.error('Schema error:', testError);
    } else {
      console.log('✅ Table is accessible but empty. Try with these columns:');
      console.log('   - id, device_id, defect_type, detected_at, confidence, image_url, image_path, status, notes');
    }
  }
}

checkSchema().catch(console.error);
