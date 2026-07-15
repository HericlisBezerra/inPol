import { cn } from "@/lib/utils";

export function InpolLogo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm" ? "text-2xl" : size === "lg" ? "text-5xl" : "text-3xl";
  return (
    <span
      className={cn(
        "font-display font-semibold leading-none tracking-tight select-none",
        sizeClass,
        className,
      )}
      aria-label="Inpol"
    >
      <span className="text-foreground">In</span>
      <span className="italic text-primary">pol</span>
      <span className="text-primary">.</span>
    </span>
  );
}
