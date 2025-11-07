#!/usr/bin/env python3
"""
Enhanced Python 3.9 compatibility fixer
Handles all edge cases including Literal types and misplaced imports
"""
import re
import os
from pathlib import Path


def fix_file(filepath):
    """Fix a single file's type hints for Python 3.9 compatibility"""
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content

    # Step 1: Remove wrongly placed "from typing import Optional" lines
    # These are lines that appear in the middle of import blocks or after "from xxx import ("
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Check if this is a standalone "from typing import Optional" that looks suspicious
        if line.strip() == "from typing import Optional":
            # Check if previous line ends with "(" or previous non-empty line is an import
            if i > 0:
                prev_line = lines[i-1].strip()
                if prev_line.endswith('(') or prev_line.startswith('from ') or prev_line.startswith('import '):
                    # Skip this line - it's in the wrong place
                    i += 1
                    continue
        fixed_lines.append(line)
        i += 1

    content = '\n'.join(fixed_lines)

    # Step 2: Fix Literal[...] | None patterns
    content = re.sub(r'Literal\[([^\]]+)\]\s*\|\s*None', r'Optional[Literal[\1]]', content)

    # Step 3: Fix dict[...] patterns
    content = re.sub(r'\bdict\[', 'Dict[', content)

    # Step 4: Fix list[...] patterns
    content = re.sub(r'\blist\[', 'List[', content)

    # Step 5: Check if imports need to be added
    has_optional = 'from typing import' in content and 'Optional' in content
    has_dict = 'from typing import' in content and 'Dict' in content
    has_list = 'from typing import' in content and 'List' in content
    has_literal = 'from typing import' in content and 'Literal' in content

    uses_optional = 'Optional[' in content
    uses_dict = 'Dict[' in content
    uses_list = 'List[' in content
    uses_literal = 'Literal[' in content

    # Find existing typing import
    typing_import_match = re.search(r'^from typing import (.+)$', content, re.MULTILINE)

    if typing_import_match:
        # Existing typing import found - add missing imports to it
        existing_imports = typing_import_match.group(1)
        imports_to_add = []

        if uses_optional and 'Optional' not in existing_imports:
            imports_to_add.append('Optional')
        if uses_dict and 'Dict' not in existing_imports:
            imports_to_add.append('Dict')
        if uses_list and 'List' not in existing_imports:
            imports_to_add.append('List')
        if uses_literal and 'Literal' not in existing_imports:
            imports_to_add.append('Literal')

        if imports_to_add:
            # Parse existing imports
            if existing_imports.strip().endswith(','):
                new_imports = f"{existing_imports.rstrip(',')} {', '.join(imports_to_add)}"
            else:
                new_imports = f"{existing_imports}, {', '.join(imports_to_add)}"

            content = content.replace(
                f"from typing import {existing_imports}",
                f"from typing import {new_imports}"
            )
    else:
        # No typing import - add one if needed
        imports_needed = []
        if uses_optional:
            imports_needed.append('Optional')
        if uses_dict:
            imports_needed.append('Dict')
        if uses_list:
            imports_needed.append('List')
        if uses_literal:
            imports_needed.append('Literal')

        if imports_needed:
            # Find first import line
            lines = content.split('\n')
            insert_index = -1

            for i, line in enumerate(lines):
                if line.startswith('import ') or line.startswith('from '):
                    insert_index = i
                    break

            if insert_index >= 0:
                lines.insert(insert_index, f"from typing import {', '.join(imports_needed)}")
                content = '\n'.join(lines)

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
