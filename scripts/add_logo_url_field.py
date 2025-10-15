#!/usr/bin/env python3
"""
Add logo_url field to openrouter_models table
"""

import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.supabase_config import get_supabase_client

def add_logo_url_field():
    """Add logo_url field to openrouter_models table"""
    print("🔧 Adding logo_url field to openrouter_models table...")
    
    try:
        client = get_supabase_client()
        
        # First, check if the field already exists
        result = client.table('openrouter_models').select('logo_url').limit(1).execute()
        
        if result.data is not None:
            print("✅ logo_url field already exists in openrouter_models table")
            return True
            
    except Exception as e:
        # If we get an error, the field probably doesn't exist
        print(f"ℹ️  logo_url field not found, attempting to add it...")
        print(f"Error details: {e}")
    
    print("💡 To add the logo_url field, run this SQL in your Supabase dashboard:")
    print("ALTER TABLE openrouter_models ADD COLUMN logo_url TEXT;")
    print("\nOr use the Supabase CLI:")
    print("supabase db push")
    
    return False

def test_logo_generation():
    """Test logo URL generation for the authors in the table"""
    print("\n🧪 Testing logo URL generation...")
    
    # Sample authors from the table
    authors = ['x-ai', 'anthropic', 'deepseek', 'google', 'openai', 'z-ai']
    
    for author in authors:
        logo_url = generate_logo_url_from_author(author)
        print(f"  {author} -> {logo_url}")

def generate_logo_url_from_author(author: str) -> str:
    """Generate logo URL from author name using Google favicon service"""
    if not author:
        return None
    
    # Map author names to domains
    author_domain_map = {
        'openai': 'openai.com',
        'anthropic': 'anthropic.com',
        'google': 'google.com',
        'x-ai': 'x.ai',
        'deepseek': 'deepseek.com',
        'z-ai': 'zhipuai.cn',
        'meta': 'meta.com',
        'microsoft': 'microsoft.com',
        'cohere': 'cohere.com',
        'mistralai': 'mistral.ai',
        'perplexity': 'perplexity.ai',
        'amazon': 'aws.amazon.com',
        'baidu': 'baidu.com',
        'tencent': 'tencent.com',
        'alibaba': 'alibaba.com',
        'ai21': 'ai21.com',
        'inflection': 'inflection.ai'
    }
    
    # Get domain for author
    domain = author_domain_map.get(author.lower())
    if not domain:
        # Try to use author as domain if it looks like a domain
        if '.' in author:
            domain = author
        else:
            return None
    
    # Generate Google favicon URL
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"

if __name__ == "__main__":
    add_logo_url_field()
    test_logo_generation()
    
    print("\n🎯 Next steps:")
    print("1. Add the logo_url field to your table (see SQL above)")
    print("2. Run: python test_ranking_endpoint.py")
    print("3. Check the /ranking/models endpoint")
