"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dbFrom } from "@/lib/clientDbBroker";
import {
  arraysEqualAsSets,
  normalizePersonaleSearchText,
  resolvePersonaleSelection,
  type PersonaleSelectionOption,
} from "@/lib/personaleAssignments";

type ChangePayload = {
  personaleIds: string[];
  personaleDisplay: string;
  unresolvedLegacyTokens: string[];
};

type Props = {
  personaleIds: string[];
  legacyValue?: string | null;
  onChange: (value: ChangePayload) => void;
  placeholder?: string;
  disabled?: boolean;
};

let personaleOptionsCache: PersonaleSelectionOption[] | null = null;
let personaleOptionsPromise: Promise<PersonaleSelectionOption[]> | null = null;

async function loadPersonaleOptions() {
  if (personaleOptionsCache) return personaleOptionsCache;
  if (personaleOptionsPromise) return personaleOptionsPromise;

  personaleOptionsPromise = (async () => {
    const [personaleRes, aziendeRes] = await Promise.all([
      dbFrom("personale")
        .select("id,nome,cognome,azienda_id,tipo,attivo")
        .eq("attivo", true)
        .order("cognome", { ascending: true })
        .order("nome", { ascending: true }),
      dbFrom("aziende")
        .select("id,ragione_sociale")
        .eq("attiva", true)
        .order("ragione_sociale", { ascending: true }),
    ]);

    if (personaleRes.error) throw new Error(personaleRes.error.message);
    if (aziendeRes.error) throw new Error(aziendeRes.error.message);

    const aziendeById = new Map<string, string>();
    for (const row of ((aziendeRes.data as any[]) || []) as Array<Record<string, any>>) {
      aziendeById.set(String(row.id || ""), String(row.ragione_sociale || "").trim());
    }

    const options = (((personaleRes.data as any[]) || []) as Array<Record<string, any>>)
      .map((row) => {
        const id = String(row.id || "").trim();
        const nome = String(row.nome || "").trim();
        const cognome = String(row.cognome || "").trim();
        const aziendaNome = aziendeById.get(String(row.azienda_id || "").trim()) || "";
        const tipo = String(row.tipo || "").toUpperCase();
        const label = [nome, cognome].filter(Boolean).join(" ").trim();
        const display =
          tipo === "ESTERNO" && aziendaNome ? `${label} · ${aziendaNome}` : label || aziendaNome;
        const search = normalizePersonaleSearchText(`${label} ${aziendaNome} ${tipo}`);
        if (!id || !label) return null;
        return { id, label, display, search } satisfies PersonaleSelectionOption;
      })
      .filter(Boolean) as PersonaleSelectionOption[];

    personaleOptionsCache = options;
    return options;
  })();

  try {
    return await personaleOptionsPromise;
  } finally {
    personaleOptionsPromise = null;
  }
}

export default function PersonaleMultiSelect({
  personaleIds,
  legacyValue,
  onChange,
  placeholder = "Cerca e seleziona personale...",
  disabled,
}: Props) {
  const [options, setOptions] = useState<PersonaleSelectionOption[]>(personaleOptionsCache || []);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    if (personaleOptionsCache) return;
    loadPersonaleOptions()
      .then((rows) => {
        if (!active) return;
        setOptions(rows);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(String(err?.message || "Errore caricamento personale"));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resolved = useMemo(
    () => resolvePersonaleSelection(personaleIds, legacyValue, options),
    [personaleIds, legacyValue, options]
  );

  useEffect(() => {
    if (options.length === 0) return;
    const nextDisplay = resolved.displayValue;
    const currentDisplay = String(legacyValue || "").trim();
    if (
      !arraysEqualAsSets(resolved.selectedIds, personaleIds) ||
      nextDisplay !== currentDisplay
    ) {
      onChange({
        personaleIds: resolved.selectedIds,
        personaleDisplay: nextDisplay,
        unresolvedLegacyTokens: resolved.unresolvedLegacyTokens,
      });
    }
  }, [legacyValue, onChange, options.length, personaleIds, resolved]);

  const selectedOptions = useMemo(
    () => options.filter((option) => resolved.selectedIds.includes(option.id)),
    [options, resolved.selectedIds]
  );

  const filteredOptions = useMemo(() => {
    const needle = normalizePersonaleSearchText(query);
    if (!needle) return options;
    return options.filter((option) => option.search.includes(needle));
  }, [options, query]);

  function emit(nextSelectedIds: string[], unresolvedLegacyTokens = resolved.unresolvedLegacyTokens) {
    onChange({
      personaleIds: nextSelectedIds,
      personaleDisplay: resolvePersonaleSelection(nextSelectedIds, unresolvedLegacyTokens.join("; "), options)
        .displayValue,
      unresolvedLegacyTokens,
    });
  }

  function toggleOption(optionId: string) {
    if (disabled) return;
    const nextIds = resolved.selectedIds.includes(optionId)
      ? resolved.selectedIds.filter((id) => id !== optionId)
      : [...resolved.selectedIds, optionId];
    emit(nextIds);
  }

  function removeLegacyToken(token: string) {
    emit(
      resolved.selectedIds,
      resolved.unresolvedLegacyTokens.filter((value) => value !== token)
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        style={{
          width: "100%",
          minHeight: 42,
          padding: "10px 12px",
          textAlign: "left",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          background: disabled ? "#f9fafb" : "white",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {selectedOptions.length > 0 || resolved.unresolvedLegacyTokens.length > 0
          ? `${selectedOptions.length} selezionati${
              resolved.unresolvedLegacyTokens.length
                ? ` · legacy ${resolved.unresolvedLegacyTokens.length}`
                : ""
            }`
          : placeholder}
      </button>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {selectedOptions.map((option) => (
          <span
            key={option.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              padding: "4px 10px",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {option.display}
          </span>
        ))}
        {resolved.unresolvedLegacyTokens.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => removeLegacyToken(token)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              padding: "4px 10px",
              border: "1px dashed #d1d5db",
              background: "#f9fafb",
              color: "#4b5563",
              fontSize: 12,
              cursor: "pointer",
            }}
            title="Valore legacy non collegato. Clicca per rimuoverlo."
          >
            Legacy non collegati: {token}
          </button>
        ))}
      </div>

      {error ? <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>{error}</div> : null}

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 30,
            marginTop: 6,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            padding: 10,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca nome, cognome o azienda..."
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
          />
          <div style={{ maxHeight: 240, overflow: "auto", display: "grid", gap: 4 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: 8, fontSize: 12, opacity: 0.7 }}>Nessuna persona trovata</div>
            ) : (
              filteredOptions.map((option) => {
                const checked = resolved.selectedIds.includes(option.id);
                return (
                  <label
                    key={option.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "8px 6px",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: checked ? "#eff6ff" : "white",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOption(option.id)}
                    />
                    <span>
                      <span style={{ display: "block", fontWeight: 700 }}>{option.label}</span>
                      {option.display !== option.label ? (
                        <span style={{ display: "block", fontSize: 12, color: "#6b7280" }}>
                          {option.display.replace(`${option.label} · `, "")}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
