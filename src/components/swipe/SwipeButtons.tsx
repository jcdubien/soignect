"use client";

interface SwipeButtonsProps {
  onNope: () => void;
  onLike: () => void;
  disabled?: boolean;
}

export default function SwipeButtons({ onNope, onLike, disabled }: SwipeButtonsProps) {
  return (
    <div className="flex justify-center items-center gap-8 pb-8 pt-2">
      <button
        onClick={onNope}
        disabled={disabled}
        className="w-16 h-16 rounded-full bg-white shadow-lg border-2 border-red-200 flex items-center justify-center text-2xl hover:scale-110 hover:border-red-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        aria-label="Passer"
      >
        ✕
      </button>
      <button
        onClick={onLike}
        disabled={disabled}
        className="w-20 h-20 rounded-full bg-kine-500 shadow-xl flex items-center justify-center text-3xl hover:scale-110 hover:bg-kine-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        aria-label="Liker"
      >
        ♥
      </button>
    </div>
  );
}
