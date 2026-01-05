import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CloseIcon, PlusIcon, DotsIcon } from "../Icons";
import ConfirmationModal from "./ConfirmationModal";
import { API_URL } from "../types";
import type { BrainLiftSummary } from "../types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  savedList: BrainLiftSummary[];
  currentId: string | null;
  onDelete: (id: string) => void;
  onRefresh?: (id: string) => void;
}

export default function Sidebar({ isOpen, onClose, savedList, currentId, onDelete, onRefresh }: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();

  const handleDeleteClick = (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(null);
    setDeleteConfirm({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const res = await fetch(`${API_URL}/brainlifts/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete(deleteConfirm.id);
        if (currentId === deleteConfirm.id) {
          navigate("/");
        }
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
    setDeleteConfirm(null);
  };

  const handleRefreshClick = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(null);

    try {
      const res = await fetch(`${API_URL}/brainlifts/${id}/refresh`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Refresh failed");
      }

      const data = await res.json();

      if (data.has_changes) {
        toast.success("Changes detected! Refreshing...");
        if (onRefresh) {
          onRefresh(id);
        }
      } else {
        toast("No changes detected", {
          style: { background: "var(--bg-elevated)", color: "var(--dok4-primary)" },
        });
      }
    } catch (err) {
      toast.error(`Refresh failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleItemClick = (id: string) => {
    navigate(`/bl/${id}`);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div className={`sidebar-overlay ${isOpen ? "open" : ""}`} onClick={onClose} />

      {/* Sidebar */}
      <aside className={`sidebar custom-scrollbar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Visualizations
          </h2>
          <button onClick={onClose} className="btn-icon !w-8 !h-8">
            <CloseIcon />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--border-subtle)]">
          <Link
            to="/"
            onClick={onClose}
            className="btn-secondary w-full justify-center"
          >
            <PlusIcon />
            New Visualization
          </Link>
        </div>

        <div className="sidebar-content">
          <ul className="space-y-1">
            {savedList.map((bl) => (
              <li key={bl.id} className="relative group">
                <div
                  onClick={() => handleItemClick(bl.id)}
                  className={`sidebar-item ${currentId === bl.id ? "active" : ""}`}
                >
                  <span className="truncate flex-1 text-sm">{bl.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === bl.id ? null : bl.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--bg-hover)] rounded transition-all"
                  >
                    <DotsIcon />
                  </button>
                </div>

                {menuOpen === bl.id && (
                  <div className="absolute right-4 top-full mt-1 glass-panel py-1 min-w-[120px] z-20">
                    <button
                      onClick={(e) => handleRefreshClick(bl.id, e)}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(bl.id, bl.name, e)}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
            {savedList.length === 0 && (
              <li className="text-sm text-[var(--text-muted)] px-4 py-3">
                No visualizations yet
              </li>
            )}
          </ul>
        </div>
      </aside>

      <ConfirmationModal
        isOpen={deleteConfirm !== null}
        title="Delete Visualization"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmStyle="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
}
