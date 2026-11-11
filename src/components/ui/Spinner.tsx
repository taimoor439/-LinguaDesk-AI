export type SpinnerProps = {
  /** Accessible label announced to screen readers. */
  label?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASSES = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
} as const;

export default function Spinner({ label = "Loading…", size = "md" }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className="inline-flex items-center gap-2">
      <span
        className={`animate-spin rounded-full border-teal-600 border-t-transparent ${SIZE_CLASSES[size]}`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
