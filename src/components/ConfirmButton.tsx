"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ui";

export type ConfirmButtonProps = {
  /** Button label, e.g. "Delete". */
  label: string;
  /** Title shown in the confirmation dialog. */
  confirmTitle: string;
  /** Explanation shown in the confirmation dialog. */
  confirmText: string;
  /** Server action that performs the deletion. Runs only after confirmation. */
  onConfirm: () => Promise<{ error: string | null }>;
  /** Page to navigate to after a successful deletion. */
  redirectTo?: string;
};

/**
 * Danger button that asks for confirmation in a modal before running a
 * server action. Used for contact / saved-reply / member deletion.
 */
export default function ConfirmButton({
  label,
  confirmTitle,
  confirmText,
  onConfirm,
  redirectTo,
}: ConfirmButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      const result = await onConfirm();
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => (deleting ? null : setOpen(false))}
        title={confirmTitle}
        description={confirmText}
      >
        {error ? (
          <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={deleting}>
            {label}
          </Button>
        </div>
      </Modal>
    </>
  );
}
