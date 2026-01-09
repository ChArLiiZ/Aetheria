#!/bin/bash

# Script to update all Supabase service files to use the new retry mechanism
# This replaces the old Promise.race pattern with the new withRetry function

echo "Updating Supabase service files with retry mechanism..."

# Get all Supabase service files
SERVICE_FILES=$(find services/supabase -name "*.ts" -type f)

for file in $SERVICE_FILES; do
    echo "Processing: $file"

    # Check if file already has withRetry import
    if ! grep -q "import.*withRetry" "$file"; then
        # Add import after the supabase client import
        sed -i '/import.*supabase.*client/a import { withRetry } from '"'"'@/lib/supabase/retry'"'"';' "$file"
        echo "  ✓ Added withRetry import"
    fi

    echo "  → Manual review needed for Promise.race replacements"
done

echo ""
echo "✓ Import updates complete!"
echo ""
echo "Next steps:"
echo "1. Review each file and replace Promise.race patterns with withRetry"
echo "2. Test the changes"
echo "3. Commit the updates"
echo ""
echo "Example replacement:"
echo "  Before:"
echo "    const timeoutPromise = new Promise<never>(...);"
echo "    const result = await Promise.race([fetchPromise, timeoutPromise]);"
echo ""
echo "  After:"
echo "    return withRetry(async () => {"
echo "      const { data, error } = await supabase..."
echo "      if (error) throw new Error(...);"
echo "      return data;"
echo "    });"
