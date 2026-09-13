import React, { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { getConfiguredUrl, hasSavedAnonKey, saveSupabaseConfig, clearSupabaseConfig } from "./lib/supabaseClient";

// Kept visually consistent with Space10App's own token palette, but defined
// locally so this file has no dependency on the rest of the app -- it needs
// to be able to render before anything else (including the Supabase client
// itself) is ready.
const tokens = {
  bgDeep: "#0E1029",
  bgPanel: "#161A3B",
  bgRaised: "#1E2350",
  accentMint: "#6FE7C7",
  accentCoral: "#E8737A",
  textPrimary: "#F1F2FB",
  textMuted: "#8B90B8",
  border: "#2A2F5C",
};

export default function SupabaseSetupScreen({ onSaved, onCancel }) {
  const [url, setUrl] = useState(getConfiguredUrl());
  const [anonKey, setAnonKey] = useState(""); // never pre-filled with the real saved key
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const keyAlreadySaved = hasSavedAnonKey();

  const handleSave = () => {
    setError("");
    setSaving(true);
    try {
      saveSupabaseConfig(url, anonKey);
      onSaved();
    } catch (err) {
      setError(err.message || "Could not save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    clearSupabaseConfig();
    setUrl(getConfiguredUrl());
    setAnonKey("");
    setError("");
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    background: tokens.bgRaised,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    padding: "12px 44px 12px 14px",
    color: tokens.textPrimary,
    fontFamily: "'Inter', sans-serif",
    fontSize: 15,
  };

  return (
    <div style={{ padding: "50px 24px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <ShieldCheck size={20} color={tokens.accentMint} />
        <div style={{ fontSize: 20, fontWeight: 700, color: tokens.textPrimary }}>Supabase configuration</div>
      </div>
      <div style={{ fontSize: 13, color: tokens.textMuted, marginBottom: 24 }}>
        Paste your project's credentials below. They're saved in this browser only --
        never written into the app's source code.
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 6 }}>Supabase Project URL</div>
        <input
          type="text"
          placeholder="Fill in Project URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 6 }}>Supabase Anon/Public Key</div>
        <div style={{ position: "relative" }}>
          <input
            type={showKey ? "text" : "password"}
            placeholder="Fill in Anon/Public Key"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? "Hide key" : "Show key"}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
            }}
          >
            {showKey ? <EyeOff size={18} color={tokens.textMuted} /> : <Eye size={18} color={tokens.textMuted} />}
          </button>
        </div>
        {keyAlreadySaved && (
          <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 6 }}>
            A key is already saved for this browser and won't be shown here again. Leave this
            blank to keep it, or paste a new one to replace it.
          </div>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: tokens.accentCoral, marginTop: 10, marginBottom: 4 }}>{error}</div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%",
          marginTop: 16,
          background: tokens.accentMint,
          color: "#0E1029",
          border: "none",
          borderRadius: 10,
          padding: "12px 16px",
          fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
          fontSize: 15,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Saving…" : "Save Configuration"}
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        {onCancel && (
          <span style={{ fontSize: 12, color: tokens.textMuted, cursor: "pointer" }} onClick={onCancel}>
            Cancel
          </span>
        )}
        {keyAlreadySaved && (
          <span style={{ fontSize: 12, color: tokens.accentCoral, cursor: "pointer", marginLeft: "auto" }} onClick={handleClear}>
            Clear saved configuration
          </span>
        )}
      </div>
    </div>
  );
}
