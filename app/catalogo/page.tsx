'use client'

import { useEffect, useMemo, useState } from 'react'
import ConfigMancante from '@/components/ConfigMancante'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'

type CatalogItem = {
  id: string
  codice: string
  descrizione: string
  tipo: string | null
  attivo: boolean
  created_at?: string
}

function norm(s: string) {
  return (s ?? '').trim()
}

export default function CatalogoPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />
  }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [items, setItems] = useState<CatalogItem[]>([])
  const [q, setQ] = useState('')

  // form nuova voce
  const [codice, setCodice] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [tipo, setTipo] = useState('') // stringa vuota => null

  // edit inline
  const [editId, setEditId] = useState<string | null>(null)
  const [editCodice, setEditCodice] = useState('')
  const [editDescrizione, setEditDescrizione] = useState('')
  const [editTipo, setEditTipo] = useState('')
  const [editAttivo, setEditAttivo] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('catalog_items')
      .select('id,codice,descrizione,tipo,attivo,created_at')
      .order('codice', { ascending: true })
      .order('descrizione', { ascending: true })

    if (error) setError(error.message)
    setItems((data ?? []) as CatalogItem[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const s = norm(q).toLowerCase()
    if (!s) return items
    return items.filter((it) => {
      return (
        it.codice.toLowerCase().includes(s) ||
        it.descrizione.toLowerCase().includes(s) ||
        String(it.tipo ?? '').toLowerCase().includes(s)
      )
    })
  }, [items, q])

  async function onCreate() {
    setError(null)

    const c = norm(codice).toUpperCase()
    const d = norm(descrizione)
    const t = norm(tipo) || null

    if (!c) return setError('Codice obbligatorio')
    if (!d) return setError('Descrizione obbligatoria')

    setSaving(true)

    /**
     * Usiamo UPSERT su (codice, descrizione) così:
     * - se esiste già la coppia, la riattiviamo e aggiorniamo tipo
     * - se non esiste, la inseriamo
     *
     * Nota: funziona se hai UNIQUE(codice, descrizione) come da screenshot.
     */
    const { error } = await supabase
      .from('catalog_items')
      .upsert(
        {
          codice: c,
          descrizione: d,
          tipo: t,
          attivo: true,
        },
        { onConflict: 'codice,descrizione' }
      )

    setSaving(false)
    if (error) return setError(error.message)

    setCodice('')
    setDescrizione('')
    setTipo('')
    await load()
  }

  function startEdit(it: CatalogItem) {
    setEditId(it.id)
    setEditCodice(it.codice)
    setEditDescrizione(it.descrizione)
    setEditTipo(it.tipo ?? '')
    setEditAttivo(!!it.attivo)
    setError(null)
  }

  function cancelEdit() {
    setEditId(null)
    setEditCodice('')
    setEditDescrizione('')
    setEditTipo('')
    setEditAttivo(true)
    setError(null)
  }

  async function saveEdit() {
    if (!editId) return

    setError(null)

    const c = norm(editCodice).toUpperCase()
    const d = norm(editDescrizione)
    const t = norm(editTipo) || null

    if (!c) return setError('Codice obbligatorio (edit)')
    if (!d) return setError('Descrizione obbligatoria (edit)')

    setSaving(true)

    const { error } = await supabase
      .from('catalog_items')
      .update({
        codice: c,
        descrizione: d,
        tipo: t,
        attivo: editAttivo,
      })
      .eq('id', editId)

    setSaving(false)
    if (error) return setError(error.message)

    cancelEdit()
    await load()
  }

  async function toggleAttivo(it: CatalogItem) {
    setError(null)

    const { error } = await supabase
      .from('catalog_items')
      .update({ attivo: !it.attivo })
      .eq('id', it.id)

    if (error) return setError(error.message)
    await load()
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>CATALOGO</div>
        </div>
        <a
          href="/"
          style={{
            padding: '6px 10px',
            borderRadius: 10,
            border: '1px solid #ddd',
            textDecoration: 'none',
            color: 'inherit',
            background: 'white',
            marginLeft: 'auto',
          }}
        >
          ← Dashboard
        </a>
      </div>

      <div style={{ opacity: 0.75, marginTop: 8 }}>
        Gestisci <b>catalog_items</b> da interfaccia (aggiungi / modifica / attiva-disattiva)
      </div>

      <div style={{ height: 16 }} />

      {error && (
        <div style={{ background: '#ffe8e8', border: '1px solid #ffb3b3', padding: 12, borderRadius: 10, marginBottom: 12 }}>
          <b>Errore:</b> {error}
        </div>
      )}

      {/* Form nuova voce */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Nuova voce</div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px 140px', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Codice *</div>
            <input
              value={codice}
              onChange={(e) => setCodice(e.target.value)}
              placeholder="es. TEC-SC / SRV-LOG / STR-TRUSS"
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Descrizione *</div>
            <input
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="es. SMART CITY TOTEM"
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Tipo (facoltativo)</div>
            <input
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="es. STRUTTURA / SERVIZIO / TECNICO / SAAS"
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button
              onClick={onCreate}
              disabled={saving}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                border: '1px solid #111827',
                background: '#111827',
                color: 'white',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Salvataggio...' : 'Aggiungi'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      {/* Search + refresh */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per codice / descrizione / tipo..."
          style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }}
        />
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', background: 'white' }}
        >
          {loading ? 'Carico...' : 'Ricarica'}
        </button>
      </div>

      <div style={{ height: 10 }} />

      {/* Tabella */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>Codice</th>
                <th style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>Descrizione</th>
                <th style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>Tipo</th>
                <th style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>Attivo</th>
                <th style={{ padding: 12, borderBottom: '1px solid #e5e7eb', width: 220 }}>Azioni</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((it) => {
                const isEditing = editId === it.id

                return (
                  <tr key={it.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <input
                          value={editCodice}
                          onChange={(e) => setEditCodice(e.target.value)}
                          style={{ width: 160, padding: 8, borderRadius: 10, border: '1px solid #d1d5db' }}
                        />
                      ) : (
                        it.codice
                      )}
                    </td>

                    <td style={{ padding: 12 }}>
                      {isEditing ? (
                        <input
                          value={editDescrizione}
                          onChange={(e) => setEditDescrizione(e.target.value)}
                          style={{ width: '100%', padding: 8, borderRadius: 10, border: '1px solid #d1d5db' }}
                        />
                      ) : (
                        it.descrizione
                      )}
                    </td>

                    <td style={{ padding: 12 }}>
                      {isEditing ? (
                        <input
                          value={editTipo}
                          onChange={(e) => setEditTipo(e.target.value)}
                          placeholder="(vuoto = null)"
                          style={{ width: '100%', padding: 8, borderRadius: 10, border: '1px solid #d1d5db' }}
                        />
                      ) : (
                        it.tipo ?? '—'
                      )}
                    </td>

                    <td style={{ padding: 12 }}>
                      {isEditing ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={editAttivo}
                            onChange={(e) => setEditAttivo(e.target.checked)}
                          />
                          {editAttivo ? 'TRUE' : 'FALSE'}
                        </label>
                      ) : (
                        <span style={{ fontWeight: 700, color: it.attivo ? '#16a34a' : '#991b1b' }}>
                          {it.attivo ? 'TRUE' : 'FALSE'}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: 12 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 10,
                              border: '1px solid #111827',
                              background: '#111827',
                              color: 'white',
                              fontWeight: 700,
                            }}
                          >
                            Salva
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 10,
                              border: '1px solid #d1d5db',
                              background: 'white',
                            }}
                          >
                            Annulla
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => startEdit(it)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 10,
                              border: '1px solid #d1d5db',
                              background: 'white',
                            }}
                          >
                            Modifica
                          </button>

                          <button
                            onClick={() => toggleAttivo(it)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 10,
                              border: '1px solid #d1d5db',
                              background: 'white',
                            }}
                          >
                            {it.attivo ? 'Disattiva' : 'Attiva'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, opacity: 0.7 }}>
                    Nessun elemento trovato.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, opacity: 0.7 }}>
                    Caricamento...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div style={{ opacity: 0.65, fontSize: 12 }}>
        Suggerimento: per i menu (es. <b>STR-*</b>, servizi, SAAS, ecc.) aggiungi qui le voci e saranno disponibili ovunque.
      </div>
    </div>
  )
}
