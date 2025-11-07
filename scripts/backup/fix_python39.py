#!/usr/bin/env python3
"""
Fix Python 3.9 compatibility by converting | None syntax to Optional[...]
"""
import re
import os
from pathlib import Path

def fix_file(filepath):
    """Fix a single file's type hints for Python 3.9 compatibility"""
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content

    # Check if Optional is already imported
    has_optional = 'from typing import Optional' in content or re.search(r'from typing import.*Optional', content)

    # Fix type hints: Type | None -> Optional[Type]
    # Handle simple cases like: str | None, int | None, dict | None
    content = re.sub(r'(\w+)\s*\|\s*None', r'Optional[\1]', content)

    # Fix more complex cases like: dict[str, Any] | None
    content = re.sub(r'(\w+\[[\w\s,\[\]]+\])\s*\|\s*None', r'Optional[\1]', content)

    # Add Optional import if needed and not present
    if content != original_content and not has_optional:
        # Find the first import statement
        lines = content.split('\n')
        insert_index = 0

        for i, line in enumerate(lines):
            if line.startswith('import ') or line.startswith('from '):
                # Find the last import in this block
                j = i
                while j < len(lines) and (lines[j].startswith('import ') or lines[j].startswith('from ') or lines[j].strip() == ''):
                    j += 1
                insert_index = j
                break

        # Insert the import
        if insert_index > 0:
            lines.insert(insert_index, 'from typing import Optional')
            content = '\n'.join(lines)
        else:
            # No imports found, add at top after docstring/shebang
            for i, line in enumerate(lines):
                if not line.startswith('#') and not line.startswith('"""') and not line.startswith("'''") and line.strip() != '':
                    lines.insert(i, 'from typing import Optional')
                    lines.insert(i + 1, '')
                    content = '\n'.join(lines)
                    break

    # Only write if changed
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

def main():
    """Fix all Python files in src/"""
    fixed_count = 0

    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    if fix_file(filepath):
                        print(f"✅ Fixed: {filepath}")
                        fixed_count += 1
                except Exception as e:
                    print(f"❌ Error fixing {filepath}: {e}")

    print(f"\n🎉 Fixed {fixed_count} files for Python 3.9 compatibility!")

if __name__ == '__main__':
    main()
