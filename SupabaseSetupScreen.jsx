import React from "react";

export default function SupabaseSetupScreen({ onSaved, onCancel }) {
  return (
    <div style={{ padding: 40, color: "#F1F2FB", fontFamily: "Inter, sans-serif", textAlign: "center" }}>
      <h2 style={{ marginBottom: 16 }}>Supabase Setup</h2>
      <p style={{ color: "#8B90B8", marginBottom: 24 }}>
        Configuration screen is temporarily simplified.
      </p>
      <button
        onClick={onSaved}
        style={{
          background: "#6FE7C7",
          color: "#0E1029",
          border: "none",
          borderRadius: 10,
          padding: "12px 24px",
          fontWeight: 600,
          cursor: "pointer",
          marginRight: 12,
        }}
      >
        Continue
      </button>
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            background: "transparent",
            color: "#F1F2FB",
            border: "1px solid #2A2F5C",
            borderRadius: 10,
            padding: "12px 24px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
