import { HTMLAttributes } from "react";

// Card Material Design 3 — elevation + border-radius 12px (item 17)
export default function Card({
  elevation = 1,
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { elevation?: 0 | 1 | 2 }) {
  const shadow = elevation === 0 ? "" : elevation === 2 ? "shadow-md" : "shadow-sm";
  return (
    <div className={`bg-white rounded-xl border border-gray-100 ${shadow} ${className}`} {...props}>
      {children}
    </div>
  );
}
