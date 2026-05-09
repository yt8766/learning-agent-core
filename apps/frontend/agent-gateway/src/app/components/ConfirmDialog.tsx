interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel }: ConfirmDialogProps) {
  return (
    <section className="modal-surface" role="dialog" aria-label={title}>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="command-actions">
        <button type="button">{cancelLabel}</button>
        <button type="button" className="danger-action">
          {confirmLabel}
        </button>
      </div>
    </section>
  );
}
