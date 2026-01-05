interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmStyle = "primary",
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold mb-2">{title}</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`btn-secondary ${
              confirmStyle === "danger"
                ? "!text-red-400 hover:!bg-red-500/10 hover:!border-red-500/30"
                : "!text-[var(--accent-primary)] hover:!bg-[var(--accent-primary)]/10"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
