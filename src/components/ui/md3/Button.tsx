import { ButtonHTMLAttributes } from "react";

type Variant = "filled" | "outlined" | "text" | "tonal";

// Bouton Material Design 3 — filled / outlined / text / tonal, avec ripple (item 17)
export default function Button({
  variant = "filled",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "md3-ripple inline-flex items-center justify-center gap-2 font-semibold text-sm rounded-xl px-5 py-3 transition-[background-color,box-shadow,transform] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
  const variants: Record<Variant, string> = {
    filled:   "bg-kine-600 text-white hover:bg-kine-700 shadow-sm hover:shadow-md",
    tonal:    "bg-kine-100 text-kine-800 hover:bg-kine-200",
    outlined: "border border-kine-300 text-kine-700 hover:bg-kine-50",
    text:     "text-kine-700 hover:bg-kine-50",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
