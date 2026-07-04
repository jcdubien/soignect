"use client";

import { ReactNode } from "react";

// Bottom sheet MD3 (mobile) / dialog centré (desktop) — item 17
// Contenu libre : passez un header/scroll/footer à l'intérieur.
export default function BottomSheet({
  open,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl md3-sheet-in ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poignée mobile */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />
        {children}
      </div>
    </div>
  );
}
