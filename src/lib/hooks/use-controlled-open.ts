import { useState } from "react";

/**
 * Supports both controlled and uncontrolled open state for dialog components.
 */
export function useControlledOpen(
  controlledOpen?: boolean,
  controlledOnOpenChange?: (open: boolean) => void
) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  return { open, setOpen };
}
