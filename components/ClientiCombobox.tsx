"use client";

import { useEffect, useRef, useState } from "react";

type ClienteOption = {
  id: string;
  denominazione: string;
  piva?: string | null;
  codice_fiscale?: string | null;
  codice_interno?: string | null;
};

type ClientiComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function ClientiCombobox({
  value,
  onValueChange,
  selectedId,
  onSelectId,
  placeholder = "Cerca cliente...",
  disabled,
}: ClientiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ClienteOption[]>([]);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (disabled) return;
    const q = value.trim();
    if (!q) {
      setOptions([]);
      return;
    }
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/clienti?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        console.log("[clienti] q=", q, "resp=", json?.data?.length ?? 0);
        if (json?.ok) {
          setOptions((json.data || []) as ClienteOption[]);
        } else {
          setOptions([]);
        }
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, disabled]);

  return (
    <div style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          if (selectedId) onSelectId(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ width: "100%", padding: 10 }}
      />
      {open && (loading || options.length > 0) && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            marginTop: 6,
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
            maxHeight: 260,
            overflow: "auto",
            zIndex: 20,
          }}
        >
          {loading && (
            <div style={{ padding: 10, fontSize: 12, opacity: 0.7 }}>
              Caricamento...
            </div>
          )}
          {!loading &&
            options.map((opt) => {
              const meta = [opt.piva, opt.codice_fiscale, opt.codice_interno]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  type="button"
                  key={opt.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onValueChange(opt.denominazione);
                    onSelectId(opt.id);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{opt.denominazione}</div>
                  {meta ? (
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{meta}</div>
                  ) : null}
                </button>
              );
            })}
          {!loading && options.length === 0 && (
            <div style={{ padding: 10, fontSize: 12, opacity: 0.7 }}>
              Nessun cliente trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
}
