#!/usr/bin/env node

/**
 * Setup Test Users - Create test users in Supabase Auth for development/testing
 * 
 * Usage: node setup-test-users.js
 * 
 * This script creates test users in Supabase Auth that can be used to test the login system
 * Uses the Supabase Admin API (service role key) to bypass email confirmation
 */

try { require('dotenv').config(); } catch (_) {}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Initialize Supabase Admin client (with service role key for user creation)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test users to create
const TEST_USERS = [
  {
    email: 'grodionahoa@pu.edu.ph',
    password: 'TestUser123!',
    role: 'employee',
    full_name: 'Grodiho Noa (Test)',
  },
  {
    email: 'qp-pancela@ps.edu.ph',
    password: 'TestUser123!',
    role: 'employee',
    full_name: 'QP Pancela (Test)',
  },
  {
    email: 'carson.clarito22@gmail.com',
    password: 'Admin123!',
    role: 'admin',
    full_name: 'Carson Clarito (Admin)',
  },
  {
    email: 'demo.employee@test.com',
    password: 'DemoPass123!',
    role: 'employee',
    full_name: 'Demo Employee',
  },
  {
    email: 'demo.admin@test.com',
    password: 'DemoAdmin123!',
    role: 'admin',
    full_name: 'Demo Admin',
  },
];

async function setupTestUsers() {
  console.log('🔧 Setting up test users in Supabase Auth...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const user of TEST_USERS) {
    try {
      // Create user with Supabase Admin API
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Skip email verification for test users
        user_metadata: {
          full_name: user.full_name,
          role: user.role,
        },
      });

      if (error) {
        // Check if user already exists
        if (error.message.includes('already registered')) {
          console.log(`⚠️  User ${user.email} already exists (skipping)`);
          successCount++;
        } else {
          console.error(`❌ Failed to create ${user.email}: ${error.message}`);
          errorCount++;
        }
      } else {
        console.log(`✅ Created user: ${user.email}`);
        console.log(`   → Password: ${user.password}`);
        console.log(`   → Role: ${user.role}`);
        successCount++;
      }

      // Try to insert profile if user was created
      if (data?.user?.id) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: user.email,
            role: user.role,
            created_at: new Date().toISOString(),
          })
          .select();

        if (profileError) {
          console.warn(`   ⚠️  Could not create profile: ${profileError.message}`);
        }
      }

      console.log();
    } catch (err) {
      console.error(`❌ Error creating ${user.email}:`, err.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Setup complete: ${successCount} users ready, ${errorCount} errors`);
  console.log('='.repeat(60));

  console.log('\n📝 Test Credentials:');
  console.log('─'.repeat(60));
  TEST_USERS.forEach((u) => {
    console.log(`Email:    ${u.email}`);
    console.log(`Password: ${u.password}`);
    console.log(`Role:     ${u.role}`);
    console.log('');
  });

  console.log('🌐 Login URL: https://Carzown.github.io/Glass-Defect-Detection-Prototype/');
  console.log('');
}

setupTestUsers();
