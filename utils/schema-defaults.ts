/**
 * Schema Default Value Utilities
 *
 * Provides consistent default value generation for world state schema fields.
 */

import type { WorldStateSchema } from '@/types';

/**
 * Get the default value for a schema field
 *
 * Priority:
 * 1. If schema has default_value_json, parse and return it
 * 2. Otherwise, return type-based default:
 *    - number: 0
 *    - bool: false
 *    - list_text: []
 *    - enum/text: ''
 */
export function getSchemaDefaultValue(schema: WorldStateSchema): any {
  // Try to use explicit default value if provided
  if (schema.default_value_json) {
    try {
      return JSON.parse(schema.default_value_json);
    } catch (e) {
      console.warn(`[getSchemaDefaultValue] Failed to parse default_value_json for schema "${schema.schema_key}":`, e);
      // Fall through to type-based defaults
    }
  }

  // Type-based defaults
  switch (schema.type) {
    case 'number':
      return 0;
    case 'bool':
      return false;
    case 'list_text':
      return [];
    case 'enum':
    case 'text':
    default:
      return '';
  }
}
