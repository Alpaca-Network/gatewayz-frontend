#!/usr/bin/env python3
"""
Check openrouter_models table schema
"""

import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.supabase_config import get_supabase_client

def check_schema():
    """Check if openrouter_models table has logo_url field"""
    print("🔍 Checking openrouter_models table schema...")
    
    try:
        client = get_supabase_client()
        
        # Try to select a few records to see the structure
        result = client.table('openrouter_models').select('*').limit(1).execute()
        
        if result.data:
            model = result.data[0]
            print("✅ Table exists and has data")
            print(f"✅ Total fields: {len(model.keys())}")
            print("📋 Available fields:")
            
            for field, value in model.items():
                field_type = type(value).__name__
                print(f"  - {field}: {field_type}")
            
            # Check specifically for logo_url
            if 'logo_url' in model:
                print(f"✅ logo_url field found: {model['logo_url']}")
            else:
                print("❌ logo_url field not found")
                print("💡 You may need to add the logo_url field to your table")
                
        else:
            print("⚠️  Table exists but has no data")
            
    except Exception as e:
        print(f"❌ Error checking schema: {e}")
        print("💡 Make sure your Supabase connection is working")

if __name__ == "__main__":
    check_schema()
