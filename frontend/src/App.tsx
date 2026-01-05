import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import "./App.css";
import HomePage from "./pages/HomePage";
import BrainLiftPage from "./pages/BrainLiftPage";
import { API_URL } from "./types";
import type { BrainLiftSummary } from "./types";

function App() {
  const [savedList, setSavedList] = useState<BrainLiftSummary[]>([]);

  const fetchSavedList = async () => {
    try {
      const res = await fetch(`${API_URL}/brainlifts`);
      const data = await res.json();
      setSavedList(data);
    } catch (e) {
      console.error("Failed to load visualizations:", e);
    }
  };

  useEffect(() => {
    fetchSavedList();
  }, []);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<HomePage savedList={savedList} onRefresh={fetchSavedList} />} />
        <Route path="/bl/:id" element={<BrainLiftPage savedList={savedList} onRefresh={fetchSavedList} />} />
      </Routes>
    </>
  );
}

export default App;
