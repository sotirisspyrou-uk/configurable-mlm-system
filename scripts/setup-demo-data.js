// Demo data setup script
// Run with: node scripts/setup-demo-data.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function setupDemoData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  console.log('🎭 Setting up demo data...')
  
  // Add demo partners
  const { data: partners, error } = await supabase
    .from('partners')
    .insert([
      {
        partner_code: 'DEMO001',
        sponsor_id: null,
        personal_volume: 5000,
        team_volume: 25000,
        direct_referrals: 5,
        status: 'active'
      },
      {
        partner_code: 'DEMO002', 
        personal_volume: 3000,
        team_volume: 12000,
        direct_referrals: 3,
        status: 'active'
      }
    ])
    .select()

  if (error) {
    console.error('Error creating demo partners:', error)
    return
  }

  console.log('✅ Demo data created successfully!')
  console.log(`Created ${partners.length} demo partners`)
}

setupDemoData()
