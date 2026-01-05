import { MenuIcon } from "../Icons";

interface MenuButtonProps {
  onClick: () => void;
  savedCount: number;
}

export default function MenuButton({ onClick, savedCount }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="btn-icon fixed top-5 left-5 z-30"
      title="Open menu"
    >
      <MenuIcon />
      {savedCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--accent-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {savedCount}
        </span>
      )}
    </button>
  );
}
