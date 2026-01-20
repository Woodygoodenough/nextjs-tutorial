import { BookOpenIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { lusitana } from "@/app/ui/fonts";

type YamyLogoProps = {
  className?: string;
  /**
   * Scales the logo (icon + text) in pixels.
   * Default matches the current design: icon 48px, text ~44px.
   */
  size?: number;
};

export default function YamyLogo({ className, size }: YamyLogoProps) {
  const iconPx = size ?? 48;
  const textPx = Math.round(iconPx * 0.92);

  return (
    <div
      className={clsx(
        lusitana.className,
        "flex flex-row items-center leading-none",
        className
      )}
    >
      <BookOpenIcon
        className="rotate-[15deg]"
        style={{ width: iconPx, height: iconPx }}
      />
      <p style={{ fontSize: textPx }}>Yamy Edu</p>
    </div>
  );
}
