import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AnimatedBackground from "../AnimatedBackground";
import MenuButton from "../components/MenuButton";
import Sidebar from "../components/Sidebar";
import { ArrowRightIcon } from "../Icons";
import { API_URL } from "../types";
import type { BrainLiftSummary, ExtractResponse } from "../types";

interface HomePageProps {
  savedList: BrainLiftSummary[];
  onRefresh: () => void;
}

export default function HomePage({ savedList, onRefresh }: HomePageProps) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleExtract = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data: ExtractResponse = await response.json();

      if (data.success && data.brainlift_id) {
        onRefresh();
        navigate(`/bl/${data.brainlift_id}`);
      } else {
        setError(data.error || "Failed to parse BrainLift");
      }
    } catch (e) {
      setError(`Connection error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      <MenuButton onClick={() => setSidebarOpen(true)} savedCount={savedList.length} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        savedList={savedList}
        currentId={null}
        onDelete={onRefresh}
      />

      {/* Hero Content */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-2xl mx-auto">
          {/* Logo/Brand */}
          <div className="mb-8 slide-up" style={{ animationFillMode: 'backwards' }}>
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-3 h-3 rounded-full bg-[var(--dok4-primary)] shadow-[0_0_12px_var(--dok4-glow)]" />
              <div className="w-3 h-3 rounded-full bg-[var(--dok3-primary)] shadow-[0_0_12px_var(--dok3-glow)]" />
              <div className="w-3 h-3 rounded-full bg-[var(--dok2-primary)] shadow-[0_0_12px_var(--dok2-glow)]" />
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-6 slide-up stagger-1" style={{ animationFillMode: 'backwards' }}>
            <span className="bg-gradient-to-r from-white via-white to-[var(--text-secondary)] bg-clip-text text-transparent">
              BrainLift
            </span>
            <br />
            <span className="bg-gradient-to-r from-[var(--dok4-primary)] via-[var(--dok3-primary)] to-[var(--dok2-primary)] bg-clip-text text-transparent">
              Connections
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-[var(--text-secondary)] text-lg md:text-xl mb-12 leading-relaxed slide-up stagger-2" style={{ animationFillMode: 'backwards' }}>
            Transform your knowledge into visual insights.
            <br className="hidden md:block" />
            See how facts, insights, and perspectives connect.
          </p>

          {/* CTA Area */}
          <div className="slide-up stagger-3 w-full max-w-md mx-auto" style={{ animationFillMode: 'backwards' }}>
            {/* Input section - always rendered, animated height */}
            <div
              className={`overflow-hidden transition-all duration-500 ease-out ${
                showInput ? 'max-h-40 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'
              }`}
            >
              <input
                type="text"
                className="input-dark w-full"
                placeholder="Paste your WorkFlowy link..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleExtract()}
                ref={(input) => { if (showInput && input) input.focus(); }}
              />
            </div>

            {/* Button - transforms from CTA to submit */}
            <button
              onClick={() => {
                if (!showInput) {
                  setShowInput(true);
                } else {
                  handleExtract();
                }
              }}
              disabled={showInput && (loading || !url.trim())}
              className={`btn-primary w-full ${!showInput ? 'pulse-glow' : ''}`}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <>
                  {showInput ? 'Visualize' : 'Visualize Now'}
                  <ArrowRightIcon />
                </>
              )}
            </button>

            {/* Error message */}
            <div className={`overflow-hidden transition-all duration-300 ${error ? 'max-h-20 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
