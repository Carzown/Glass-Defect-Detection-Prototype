#!/usr/bin/env node

/**
 * Supabase Auth Diagnostic Tool
 * Run: node backend/scripts/check-supabase-auth.js
 * 
 * This script tests:
 * 1. Environment variables are set
 * 2. Connection to Supabase
 * 3. Whether the API key is valid
 * 4. Can sign in with test credentials
 */

require('dotenv').config({ path: './Frontend/.env.local' });

const fs = require('fs');
const path = require('path');

console.log('🔧 SUPABASE AUTHENTICATION DIAGNOSTIC\n');
console.log('=' .repeat(60));

// ============================================================================
// STEP 1: Check Environment Variables
// ============================================================================

console.log('\n📋 STEP 1: Checking Environment Variables\n');

const requiredVars = {
  'REACT_APP_SUPABASE_URL': process.env.REACT_APP_SUPABASE_URL,
  'REACT_APP_SUPABASE_ANON_KEY': process.env.REACT_APP_SUPABASE_ANON_KEY,
};

let envOk = true;
for (const [varName, value] of Object.entries(requiredVars)) {
  if (value && value !== 'PASTE_YOUR_ANON_KEY_HERE') {
    const preview = value.substring(0, 30) + '...';
    console.log(`✅ ${varName}`);
    console.log(`   Value: ${preview}`);
    console.log(`   Length: ${value.length}`);
  } else {
    console.log(`❌ ${varName} - ${value ? 'PLACEHOLDER (not set properly)' : 'MISSING'}`);
    envOk = false;
  }
}

if (!envOk) {
  console.log('\n🚨 ERROR: Environment variables not properly set!\n');
  console.log('Fix: See FIX_INVALID_API_KEY.md for instructions to get fresh credentials');
  process.exit(1);
}

console.log('\n✅ All environment variables set correctly\n');

// ============================================================================
// STEP 2: Create Supabase Client
// ============================================================================

console.log('=' .repeat(60));
console.log('\n📋 STEP 2: Creating Supabase Client\n');

let supabase;
let supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
let supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

try {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client created successfully');
} catch (e) {
  console.log('❌ Failed to create Supabase client:', e.message);
  process.exit(1);
}

// ============================================================================
// STEP 3: Validate API Key
// ============================================================================

console.log('\n📋 STEP 3: Validating API Key Format\n');

try {
  const parts = supabaseKey.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid JWT format: expected 3 parts, got ${parts.length}`);
  }
  console.log('✅ JWT format is valid (has 3 parts)');
  
  // Decode payload to check project ref
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  
  console.log('\n📦 JWT Details:');
  console.log(`   Project Ref: ${payload.ref}`);
  console.log(`   Role: ${payload.role}`);
  console.log(`   Expires: ${new Date(payload.exp * 1000).toISOString()}`);
  
  // Check if key is from correct project
  const projectFromUrl = supabaseUrl.split('//')[1].split('.')[0];
  if (payload.ref !== projectFromUrl) {
    console.log(`\n⚠️ WARNING: Project mismatch!`);
    console.log(`   URL project: ${projectFromUrl}`);
    console.log(`   Key project: ${payload.ref}`);
    console.log(`   → Your API key might be from a different Supabase project!`);
  }
} catch (e) {
  console.log('❌ Error validating JWT:', e.message);
  console.log('   → Your API key format is invalid');
}

// ============================================================================
// STEP 4: Test Connection (Async)
// ============================================================================

console.log('\n' + '=' .repeat(60));
console.log('\n📋 STEP 4: Testing Supabase Connection\n');

(async () => {
  try {
    // Test 1: Get session
    console.log('Test 1: Getting current session...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log(`⚠️ Session error: ${sessionError.message}`);
    } else {
      console.log('✅ Session endpoint working');
      if (!sessionData.session) {
        console.log('   (No active session - normal, not logged in)');
      }
    }
    
    // Test 2: Read database
    console.log('\nTest 2: Reading defects table...');
    const { data: defectsData, error: defectsError } = await supabase
      .from('defects')
      .select('*', { count: 'exact', head: true });
    
    if (defectsError) {
      console.log(`❌ Database error: ${defectsError.message}`);
      console.log('   → Your API key might not have permission to read the database');
    } else {
      console.log('✅ Database accessible');
    }
    
    // Test 3: Auth test with dummy credentials
    console.log('\nTest 3: Testing authentication endpoint...');
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'test123'
    });
    
    if (authError?.message?.includes('Invalid login credentials')) {
      console.log('✅ Auth system is working');
      console.log('   (Test user doesn\'t exist - this is expected)');
    } else if (authError?.message?.includes('Invalid API key') || authError?.message?.includes('Error')) {
      console.log(`❌ Auth API Error: ${authError.message}`);
      console.log('   → This is the "Invalid API key" problem');
      console.log('   → Your Supabase credentials are not correct');
      console.log('   → See: FIX_INVALID_API_KEY.md');
    } else {
      console.log(`⚠️ Unexpected error: ${authError?.message || 'Unknown'}`);
    }
    
  } catch (e) {
    console.log(`❌ Test error: ${e.message}`);
  }
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 DIAGNOSIS COMPLETE\n');
  
  console.log('Next Step:');
  console.log('If tests passed: Restart React (Ctrl+C, then npm start)');
  console.log('If auth test failed: Follow instructions in FIX_INVALID_API_KEY.md');
  
  console.log('\n' + '=' .repeat(60) + '\n');
  
})();
