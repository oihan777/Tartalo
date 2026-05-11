export function LoadingDots() {
  return (
    <div className="flex items-center gap-1 text-parchment/60">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-moss-300 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-moss-300" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-moss-300 [animation-delay:0.2s]" />
    </div>
  );
}
