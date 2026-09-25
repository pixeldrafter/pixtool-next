/**
 * Veritabanı — NocoDB tarayıcısı.
 *
 * Solda base içindeki tablolar, sağda seçili tablonun kayıtları.
 * Arama tüm sütunlarda çalışır; hücre değerleri okunabilir biçimde gösterilir.
 *
 * Salt okunurdur — kayıt ekleme/silme NocoDB panelinden yapılır.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "../../desktop/ui/Card";
import { describeError, fetchStatus, type StatusResponse } from "../../lib/api";
import {
  fetchDatabaseTables,
  fetchTableRecords,
  formatCell,
  type DatabaseTable,
} from "../../lib/databaseApi";
import { useBackendConfig } from "../../lib/useBackendConfig";
import "../apps.css";
import "./database-window.css";

export function DatabaseWindow() {
  const backend = useBackendConfig();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(50);

  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nocodb = status?.integrations.nocodb;

  // --- Durum + tablolar ---
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await fetchStatus());
    } catch (caught) {
      setError(describeError(caught));
    }

    try {
      const list = await fetchDatabaseTables();
      setTables(list);
      setSelected((current) => current ?? list[0]?.id ?? null);
    } catch (caught) {
      // Tablolar alınamazsa durum kartları yine görünsün
      setTables([]);
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // --- Kayıtlar ---
  useEffect(() => {
    if (!selected) {
      setRecords([]);
      setColumns([]);
      return undefined;
    }

    const controller = new AbortController();
    setRecordsLoading(true);

    void fetchTableRecords(selected, { limit, signal: controller.signal })
      .then((data) => {
        setRecords(data.records);
        setColumns(data.columns);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setRecords([]);
          setColumns([]);
          setError(describeError(caught));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecordsLoading(false);
      });

    return () => controller.abort();
  }, [selected, limit]);

  const currentTable = tables.find((table) => table.id === selected) ?? null;

  // --- Arama (tüm sütunlarda) ---
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    if (!needle) return records;
    return records.filter((record) =>
      Object.values(record).some((value) =>
        formatCell(value).toLocaleLowerCase("tr").includes(needle),
      ),
    );
  }, [records, query]);

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Veritabanı</h2>
        <span className="app__subtitle">NocoDB — canlı veri</span>
        <span className="app__spacer" />
        <input
          className="app-input"
          type="search"
          placeholder="Kayıtlarda ara…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={!records.length}
        />
        <select
          className="app-select"
          value={String(limit)}
          onChange={(event) => setLimit(Number(event.target.value))}
          title="Kayıt sayısı"
        >
          <option value="25">25 kayıt</option>
          <option value="50">50 kayıt</option>
          <option value="100">100 kayıt</option>
          <option value="200">200 kayıt</option>
        </select>
        <button className="app-btn" onClick={() => void load()} disabled={loading}>
          {loading ? "…" : "⟳"}
        </button>
      </div>

      {/* --- Bağlantı kartları --- */}
      <div className="cards">
        <Card
          label="Bağlantı"
          value={nocodb?.ok ? "Bağlı" : nocodb?.reachable ? "Token geçersiz" : "Bağlı değil"}
          tone={nocodb?.ok ? "ok" : "warn"}
          detail={nocodb?.detail ?? ""}
        />
        <Card
          label="Tablo"
          value={String(tables.length)}
          tone={tables.length ? "ok" : "warn"}
          detail="Base içindeki tablo sayısı"
        />
        <Card
          label="Kayıt"
          value={String(records.length)}
          tone="info"
          detail={currentTable ? currentTable.title : "Tablo seçilmedi"}
        />
        <Card
          label="Adaptör"
          value={backend.dbAdapter}
          tone="info"
          detail="Tüm veri NocoDB'de"
        />
      </div>

      {error && <div className="app-msg app-msg--error">{error}</div>}

      {/* --- Tablo + kayıtlar --- */}
      {tables.length === 0 && !loading ? (
        <div className="app-msg app-msg--info">
          <strong>Tablo bulunamadı.</strong> NocoDB yapılandırmasını kontrol edin
          (<code>NOCODB_BASE_URL</code>, <code>NOCODB_API_TOKEN</code>,{" "}
          <code>NOCODB_BASE_ID</code>).
        </div>
      ) : (
        <div className="app__split">
          {/* Tablo listesi */}
          <div className="app-list">
            {tables.map((table) => (
              <button
                key={table.id}
                type="button"
                className={`app-list__item${table.id === selected ? " is-active" : ""}`}
                onClick={() => setSelected(table.id)}
              >
                <span className="app-list__name">{table.title}</span>
                <span className="app-list__meta">
                  <span className="app-table__mono">{table.table_name}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Kayıtlar */}
          <div className="app-panel">
            {!currentTable && <div className="app-empty">Soldan bir tablo seç</div>}

            {currentTable && (
              <>
                <div className="app-panel__head">
                  <div>
                    <h3 className="app__title" style={{ fontSize: 13 }}>
                      {currentTable.title}
                    </h3>
                    <p className="app__subtitle">
                      {filtered.length} / {records.length} kayıt · {columns.length} sütun
                    </p>
                  </div>
                </div>

                {recordsLoading ? (
                  <div className="app-loading">
                    <span className="app-spinner" /> Kayıtlar yükleniyor…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="app-empty">
                    {records.length === 0 ? "Bu tablo boş" : "Aramaya uyan kayıt yok"}
                  </div>
                ) : (
                  <div className="db-table-wrap">
                    <table className="app-table db-table">
                      <thead>
                        <tr>
                          <th className="db-table__num">#</th>
                          {columns.map((column) => (
                            <th key={column}>{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((record, index) => (
                          <tr key={String(record["Id"] ?? index)}>
                            <td className="db-table__num mono">{index + 1}</td>
                            {columns.map((column) => (
                              <td key={column} title={formatCell(record[column])}>
                                {formatCell(record[column])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
