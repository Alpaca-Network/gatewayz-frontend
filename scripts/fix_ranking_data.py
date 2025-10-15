#!/usr/bin/env python3
"""
Fix ranking data in openrouter_models table
"""

import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.supabase_config import get_supabase_client

def analyze_ranking_data():
    """Analyze the current ranking data"""
    print("🔍 Analyzing ranking data...")
    
    try:
        client = get_supabase_client()
        
        # Get all records to analyze
        result = client.table('openrouter_models').select('*').order('id', desc=False).execute()
        
        if result.data:
            print(f"✅ Found {len(result.data)} total records")
            
            # Group by rank
            rank_counts = {}
            for model in result.data:
                rank = model.get('rank', 0)
                rank_counts[rank] = rank_counts.get(rank, 0) + 1
            
            print("\n📊 Rank Distribution:")
            print("-" * 30)
            for rank in sorted(rank_counts.keys()):
                count = rank_counts[rank]
                print(f"Rank {rank}: {count} records")
            
            # Check for duplicates
            print(f"\n🔍 Duplicate Analysis:")
            print("-" * 30)
            if rank_counts.get(1, 0) > 1:
                print(f"❌ Found {rank_counts[1]} records with rank 1 (should be only 1)")
            
            # Show unique models
            unique_models = set()
            for model in result.data:
                model_name = model.get('model_name', '')
                author = model.get('author', '')
                unique_models.add(f"{model_name} ({author})")
            
            print(f"📋 Unique Models: {len(unique_models)}")
            print("First 10 unique models:")
            for i, model in enumerate(list(unique_models)[:10], 1):
                print(f"  {i}. {model}")
                
        else:
            print("❌ No data found")
            
    except Exception as e:
        print(f"❌ Error analyzing data: {e}")

def fix_ranking_by_id():
    """Fix ranking by using ID as rank (simple solution)"""
    print("\n🔧 Fixing ranking by ID...")
    
    try:
        client = get_supabase_client()
        
        # Get all records ordered by ID
        result = client.table('openrouter_models').select('id').order('id', desc=False).execute()
        
        if result.data:
            print(f"✅ Found {len(result.data)} records to re-rank")
            
            # Update each record with its position as rank
            for i, model in enumerate(result.data, 1):
                model_id = model['id']
                
                # Update the rank
                update_result = client.table('openrouter_models').update({
                    'rank': i
                }).eq('id', model_id).execute()
                
                if update_result.data:
                    print(f"✅ Updated ID {model_id} to rank {i}")
                else:
                    print(f"❌ Failed to update ID {model_id}")
            
            print(f"\n🎉 Successfully updated {len(result.data)} records with new rankings!")
            
        else:
            print("❌ No data found to update")
            
    except Exception as e:
        print(f"❌ Error fixing ranking: {e}")

def fix_ranking_by_tokens():
    """Fix ranking by parsing tokens and ranking by token count"""
    print("\n🔧 Fixing ranking by token count...")
    
    try:
        client = get_supabase_client()
        
        # Get all records
        result = client.table('openrouter_models').select('*').order('id', desc=False).execute()
        
        if result.data:
            print(f"✅ Found {len(result.data)} records to re-rank")
            
            # Parse token counts and sort
            models_with_tokens = []
            for model in result.data:
                tokens_str = model.get('tokens', '0B tokens')
                # Extract number from tokens string (e.g., "150B tokens" -> 150)
                try:
                    token_count = float(tokens_str.replace('B tokens', '').replace('M tokens', '').replace('K tokens', ''))
                    if 'M' in tokens_str:
                        token_count *= 1000000
                    elif 'K' in tokens_str:
                        token_count *= 1000
                    models_with_tokens.append((model['id'], token_count, model))
                except:
                    models_with_tokens.append((model['id'], 0, model))
            
            # Sort by token count (descending)
            models_with_tokens.sort(key=lambda x: x[1], reverse=True)
            
            # Update ranks
            for i, (model_id, token_count, model) in enumerate(models_with_tokens, 1):
                update_result = client.table('openrouter_models').update({
                    'rank': i
                }).eq('id', model_id).execute()
                
                if update_result.data:
                    print(f"✅ Rank {i}: {model.get('model_name', 'N/A')} ({token_count:,.0f} tokens)")
                else:
                    print(f"❌ Failed to update ID {model_id}")
            
            print(f"\n🎉 Successfully ranked {len(models_with_tokens)} models by token count!")
            
        else:
            print("❌ No data found to update")
            
    except Exception as e:
        print(f"❌ Error fixing ranking by tokens: {e}")

def verify_fix():
    """Verify the ranking fix"""
    print("\n✅ Verifying ranking fix...")
    
    try:
        client = get_supabase_client()
        
        # Get first 10 records ordered by rank
        result = client.table('openrouter_models').select('*').order('rank', desc=False).limit(10).execute()
        
        if result.data:
            print("📊 Updated Rankings (first 10):")
            print("-" * 60)
            for i, model in enumerate(result.data, 1):
                rank = model.get('rank', 'N/A')
                model_name = model.get('model_name', 'N/A')
                author = model.get('author', 'N/A')
                tokens = model.get('tokens', 'N/A')
                print(f"{i:2d}. Rank: {rank:2d} | {model_name:25s} | {author:10s} | {tokens}")
        else:
            print("❌ No data found")
            
    except Exception as e:
        print(f"❌ Error verifying fix: {e}")

if __name__ == "__main__":
    print("🔧 Fixing Ranking Data in openrouter_models table")
    print("=" * 60)
    
    analyze_ranking_data()
    
    print("\n" + "=" * 60)
    print("Choose a fix method:")
    print("1. Fix by ID (simple sequential ranking)")
    print("2. Fix by token count (rank by popularity)")
    print("3. Just analyze (no changes)")
    
    choice = input("\nEnter choice (1-3): ").strip()
    
    if choice == "1":
        fix_ranking_by_id()
        verify_fix()
    elif choice == "2":
        fix_ranking_by_tokens()
        verify_fix()
    elif choice == "3":
        print("📊 Analysis complete. No changes made.")
    else:
        print("❌ Invalid choice")
