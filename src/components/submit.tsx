"use client";

import { useFormStatus } from "react-dom";

/** Submit button that shows a stepped "working" state while a server action runs. */
export function Submit({ children, className, pendingText = "WORKING", name, value }: { children: React.ReactNode; className?: string; pendingText?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending ? <span className="cursor">{pendingText}</span> : children}
    </button>
  );
}
