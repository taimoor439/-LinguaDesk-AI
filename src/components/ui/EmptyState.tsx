import type { ReactNode } from "react";

export type EmptyStateProps = {
  /** Decorative icon (React node or emoji-free SVG). */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary action, e.g. a Button. */
  action?: ReactNode;
};

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
