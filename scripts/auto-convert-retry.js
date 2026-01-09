#!/usr/bin/env node
/**
 * Automatically convert Promise.race patterns to withRetry
 */

const fs = require('fs');
const path = require('path');

function convertPromiseRaceToWithRetry(content) {
  // Pattern to match the old Promise.race pattern
  const pattern = /\/\/ Use Promise\.race to prevent hanging issues\s+const timeoutPromise = new Promise<never>\(\(_, reject\) => \{\s+setTimeout\(\(\) => reject\(new Error\(['"`].*?['"`]\)\), \d+\);\s+\}\);\s+const (\w+) = (.*?);\s+const result = await Promise\.race\(\[(\w+), timeoutPromise\]\);\s+const \{ data, error \} = result as any;/gs;

  let newContent = content;
  let matchCount = 0;

  // Replace each match
  newContent = newContent.replace(pattern, (match, promiseName, promiseCode, racePromiseName) => {
    matchCount++;
    // Extract the query code (remove 'supabase' if it's at the start)
    const queryCode = promiseCode.trim();

    return `return withRetry(async () => {\n    const { data, error } = await ${queryCode}`;
  });

  // Fix the closing pattern - need to close the withRetry function
  newContent = newContent.replace(
    /(\s+if \(error\) \{[\s\S]*?\}\s+return.*?;)/g,
    (match) => {
      return match + '\n  });';
    }
  );

  return { newContent, matchCount };
}

function processFile(filePath) {
  console.log(`\nProcessing: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const { newContent, matchCount } = convertPromiseRaceToWithRetry(content);

  if (matchCount > 0) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`  ✓ Converted ${matchCount} Promise.race patterns`);
    return matchCount;
  } else {
    console.log(`  → No Promise.race patterns found`);
    return 0;
  }
}

function main() {
  const servicesDir = path.join(process.cwd(), 'services', 'supabase');

  if (!fs.existsSync(servicesDir)) {
    console.error(`Error: ${servicesDir} not found`);
    process.exit(1);
  }

  const files = fs.readdirSync(servicesDir)
    .filter(f => f.endsWith('.ts'))
    .map(f => path.join(servicesDir, f));

  console.log(`Found ${files.length} service files`);

  let totalConverted = 0;
  files.forEach(file => {
    totalConverted += processFile(file);
  });

  console.log(`\n✓ Converted ${totalConverted} patterns across all files`);
  console.log('\nNote: Please review the changes and test thoroughly!');
}

main();
