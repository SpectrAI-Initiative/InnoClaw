/** Escape a value for use in a YAML single-quoted scalar (double any single quotes). */
export function yamlEscape(value: string): string {
  return value.replace(/'/g, "''");
}
