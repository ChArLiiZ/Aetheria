#!/usr/bin/env python3
"""
Convert Supabase service files from Promise.race pattern to withRetry pattern
"""

import re
import os
import sys
from pathlib import Path


def convert_file(file_path):
    """Convert a single file to use withRetry"""
    print(f"Converting: {file_path}")

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Add withRetry import if not present
    if 'withRetry' not in content:
        # Find the supabase import line
        import_pattern = r"(import { supabase } from '@/lib/supabase/client';)"
        replacement = r"\1\nimport { withRetry } from '@/lib/supabase/retry';"
        content = re.sub(import_pattern, replacement, content)
        print("  ✓ Added withRetry import")

    # Count Promise.race patterns
    promise_race_count = len(re.findall(r'Promise\.race', content))

    if promise_race_count > 0:
        print(f"  → Found {promise_race_count} Promise.race patterns")
        print(f"  → Manual conversion recommended")

    # Write back if changed
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False


def main():
    """Main conversion function"""
    services_dir = Path('services/supabase')

    if not services_dir.exists():
        print(f"Error: {services_dir} not found")
        sys.exit(1)

    # Get all TypeScript files
    ts_files = list(services_dir.glob('*.ts'))

    print(f"Found {len(ts_files)} service files\n")

    converted_count = 0
    for ts_file in ts_files:
        if convert_file(ts_file):
            converted_count += 1

    print(f"\n✓ Updated {converted_count} files")
    print("\nNext: Manually convert Promise.race patterns to withRetry")
    print("See services/supabase/stories.ts for examples")


if __name__ == '__main__':
    main()
