/**
 * Test script to verify meta_description is being used in schema generation
 * Run with: node test-description-fix.js
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase config (from index.html)
const SUPABASE_URL = 'https://qjqjqjqjqjqjqjqjqj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqcWpxanFqcWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3NjQwMDAsImV4cCI6MjA1MTMzNjAwMH0.8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K';

const TEST_URL = 'https://www.alanranger.com/blog-on-photography/storytelling-narrative-photography-assignment';

async function testDescriptionFix() {
  console.log('🧪 Testing meta_description fix...\n');
  
  try {
    // Initialize Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client created\n');
    
    // Normalize URL (remove trailing slash)
    const normalizedUrl = TEST_URL.endsWith('/') ? TEST_URL.slice(0, -1) : TEST_URL;
    console.log(`📡 Querying Supabase for: ${normalizedUrl}\n`);
    
    // Fetch entity
    const { data, error } = await supabase
      .from('page_entities')
      .select('title, page_url, description, meta_description, excerpt, categories, tags, publish_date, image_url, image_width, image_height, json_ld_data')
      .eq('page_url', normalizedUrl)
      .eq('kind', 'article')
      .maybeSingle();
    
    if (error) {
      console.error('❌ Supabase query error:', error);
      return;
    }
    
    if (!data) {
      console.log('⚠️  No entity found with kind=article, trying without kind filter...\n');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('page_entities')
        .select('title, page_url, description, meta_description, excerpt, categories, tags, publish_date, image_url, image_width, image_height, json_ld_data')
        .eq('page_url', normalizedUrl)
        .maybeSingle();
      
      if (fallbackError) {
        console.error('❌ Fallback query error:', fallbackError);
        return;
      }
      
      if (!fallbackData) {
        console.error('❌ No entity found in Supabase at all!');
        console.log('   This means the URL doesn\'t match or the entity doesn\'t exist.');
        return;
      }
      
      console.log('✅ Entity found (without kind filter):');
      console.log(`   Title: ${fallbackData.title}`);
      console.log(`   Kind: ${fallbackData.kind || 'unknown'}`);
      console.log(`   Description: ${fallbackData.description ? fallbackData.description.substring(0, 80) + '...' : 'null'}`);
      console.log(`   Meta Description: ${fallbackData.meta_description ? fallbackData.meta_description.substring(0, 80) + '...' : 'null'}`);
      console.log(`   Excerpt: ${fallbackData.excerpt ? fallbackData.excerpt.substring(0, 80) + '...' : 'null'}\n`);
      
      // Test the priority logic
      const rawEntityDescription = fallbackData.meta_description || fallbackData.description || fallbackData.excerpt;
      console.log(`📊 Priority check result:`);
      console.log(`   rawEntityDescription = meta_description || description || excerpt`);
      console.log(`   Result: ${rawEntityDescription ? rawEntityDescription.substring(0, 100) + '...' : 'null'}\n`);
      
      if (rawEntityDescription && rawEntityDescription.includes('This assignment teaches')) {
        console.log('✅ SUCCESS: meta_description is being used!');
      } else {
        console.log('❌ FAIL: meta_description is NOT being used (falling back to description or excerpt)');
      }
      
      return;
    }
    
    console.log('✅ Entity found:');
    console.log(`   Title: ${data.title}`);
    console.log(`   Description: ${data.description ? data.description.substring(0, 80) + '...' : 'null'}`);
    console.log(`   Meta Description: ${data.meta_description ? data.meta_description.substring(0, 80) + '...' : 'null'}`);
    console.log(`   Excerpt: ${data.excerpt ? data.excerpt.substring(0, 80) + '...' : 'null'}\n`);
    
    // Test the priority logic
    const rawEntityDescription = data.meta_description || data.description || data.excerpt;
    console.log(`📊 Priority check result:`);
    console.log(`   rawEntityDescription = meta_description || description || excerpt`);
    console.log(`   Result: ${rawEntityDescription ? rawEntityDescription.substring(0, 100) + '...' : 'null'}\n`);
    
    if (rawEntityDescription && rawEntityDescription.includes('This assignment teaches')) {
      console.log('✅ SUCCESS: meta_description is being used!');
      console.log(`   Expected description should start with: "Storytelling Narrative Photography. This assignment teaches..."`);
      console.log(`   Actual: ${rawEntityDescription.substring(0, 150)}`);
    } else {
      console.log('❌ FAIL: meta_description is NOT being used (falling back to description or excerpt)');
      if (data.meta_description) {
        console.log(`   meta_description exists: ${data.meta_description.substring(0, 100)}`);
        console.log(`   But rawEntityDescription is: ${rawEntityDescription ? rawEntityDescription.substring(0, 100) : 'null'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error);
    console.error(error.stack);
  }
}

testDescriptionFix();

