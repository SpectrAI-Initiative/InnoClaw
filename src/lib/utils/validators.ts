/** Validate that a string is a valid DNS label (used for namespace / jobName). */
export function isValidDnsLabel(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value) && value.length <= 63;
}

/** Validate that a string looks like a valid OCI image reference. */
export function isValidImageRef(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._\-/:@]+$/.test(value) && value.length <= 512;
}
