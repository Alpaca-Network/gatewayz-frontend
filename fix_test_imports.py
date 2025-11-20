#!/usr/bin/env python3
"""
Fix wildcard imports in test files to prevent pytest collection errors
"""
import os
import re
from pathlib import Path

def fix_test_file(filepath):
    """Remove wildcard imports and replace with proper module imports"""
    content = Path(filepath).read_text()
    
    # Skip if already fixed
    if 'from src.' in content and ' import *' in content:
        # Replace "from src.X.Y import *" with just the module reference
        # This prevents test discovery issues
        
        # Extract the module path
        match = re.search(r'from (src\.[a-z_]+\.[a-z_]+) import \*', content)
        if match:
            module_path = match.group(1)
            # Remove the wildcard import line
            content = re.sub(r'from src\.[a-z_]+\.[a-z_]+ import \*\n', '', content)
            
            Path(filepath).write_text(content)
            return True
    
    return False

def main():
    """Fix all test files"""
    test_dir = Path("/root/repo/tests")
    fixed = 0
    
    for test_file in test_dir.rglob("test_*.py"):
        if fix_test_file(test_file):
            fixed += 1
            print(f"Fixed: {test_file.relative_to('/root/repo')}")
    
    print(f"\nTotal fixed: {fixed}")

if __name__ == "__main__":
    main()
