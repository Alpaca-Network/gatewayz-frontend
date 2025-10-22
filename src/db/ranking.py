import logging
from typing import List, Dict, Any, Optional
from src.config.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


def get_all_latest_models(
    limit: Optional[int] = None, 
    offset: Optional[int] = None
) -> List[Dict[str, Any]]:
    """Get all data from latest_models table for ranking page with logo URLs"""
    try:
        client = get_supabase_client()
        
        # Build query with optional pagination
        query = client.table('latest_models').select('*')
        
        # Apply ordering by rank (ascending order - rank 1 first)
        query = query.order('rank', desc=False)
        
        # Apply pagination if specified
        if offset:
            query = query.range(offset, offset + (limit or 50) - 1)
        elif limit:
            query = query.limit(limit)
        
        result = query.execute()
        
        if not result.data:
            logger.info("No models found in latest_models table")
            return []
        
        # Enhance models with logo URLs if not present
        enhanced_models = []
        for model in result.data:
            enhanced_model = model.copy()
            
            # Generate logo URL if not present
            if 'logo_url' not in model or not model.get('logo_url'):
                logo_url = generate_logo_url_from_author(model.get('author', ''))
                if logo_url:
                    enhanced_model['logo_url'] = logo_url
            
            enhanced_models.append(enhanced_model)
        
        logger.info(f"Retrieved {len(enhanced_models)} models from latest_models table with logo URLs")
        return enhanced_models
        
    except Exception as e:
        logger.error(f"Failed to get latest models: {e}")
        raise RuntimeError(f"Failed to get latest models: {e}")


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


def get_all_latest_apps() -> List[Dict[str, Any]]:
    """Get all data from latest_apps table for ranking page"""
    try:
        client = get_supabase_client()
        
        result = client.table('latest_apps').select('*').execute()
        
        if not result.data:
            logger.info("No apps found in latest_apps table")
            return []
        
        logger.info(f"Retrieved {len(result.data)} apps from latest_apps table")
        return result.data
        
    except Exception as e:
        logger.error(f"Failed to get latest apps: {e}")
        raise RuntimeError(f"Failed to get latest apps: {e}")
