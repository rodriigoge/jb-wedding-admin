import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { RsvpConfirmationRow, RsvpGuest, RsvpStatus } from "@/types/rsvp";

const statusLabels: Record<RsvpStatus | "all", string> = {
  all: "Todos",
  confirmed: "Confirmados",
  pending: "Pendentes",
  declined: "Não irão",
};

const statusClasses: Record<RsvpStatus, string> = {
  confirmed: "status-confirmed",
  pending: "status-pending",
  declined: "status-declined",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function mapRowToGuest(row: RsvpConfirmationRow): RsvpGuest {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    companions: row.companions,
    status: row.status,
    notes: row.notes,
    totalPeople: row.total_people ?? (row.status === "confirmed" ? row.companions + 1 : 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function makeCsv(rows: RsvpGuest[]) {
  const headers = ["Nome", "Telefone", "Acompanhantes", "Total de pessoas", "Status", "Observações", "Confirmado em"];
  const body = rows.map((guest) => [
    guest.name,
    guest.phone ?? "",
    String(guest.companions),
    String(guest.totalPeople),
    statusLabels[guest.status],
    guest.notes ?? "",
    formatDate(guest.createdAt),
  ]);

  return [headers, ...body]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function AdminDashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState<RsvpGuest[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RsvpStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadConfirmations() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
          await router.replace("/login");
          return;
        }

        setEmail(sessionData.session.user.email ?? "");

        const response = await fetch("/api/rsvps", {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        });
        const payload = (await response.json()) as
          | { ok: true; rows: RsvpConfirmationRow[] }
          | { ok: false; message: string };

        if (!response.ok || !payload.ok) {
          setError(payload.message);
          return;
        }

        setGuests(payload.rows.map(mapRowToGuest));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as confirmações.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadConfirmations();
  }, [router]);

  const filteredGuests = useMemo(() => {
    const search = normalize(query);

    return guests.filter((guest) => {
      const matchesStatus = status === "all" || guest.status === status;
      const matchesSearch =
        !search || normalize(`${guest.name} ${guest.phone ?? ""} ${guest.notes ?? ""}`).includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [guests, query, status]);

  const summary = useMemo(() => {
    const confirmedGuests = guests.filter((guest) => guest.status === "confirmed");

    return {
      confirmedRows: confirmedGuests.length,
      confirmedPeople: confirmedGuests.reduce((total, guest) => total + guest.totalPeople, 0),
      pendingRows: guests.filter((guest) => guest.status === "pending").length,
      declinedRows: guests.filter((guest) => guest.status === "declined").length,
    };
  }, [guests]);

  async function logout() {
    setIsLoggingOut(true);
    const supabase = getSupabaseBrowserClient();

    await supabase.auth.signOut();
    await router.push("/login");
  }

  function exportCsv() {
    const csv = makeCsv(filteredGuests);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "lista-presenca-jb.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <main className="admin-shell">
        <div className="screen-state">
          <strong>Carregando confirmações...</strong>
          <span>Estamos consultando os dados salvos no Supabase.</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="admin-shell">
        <div className="screen-state">
          <strong>Não foi possível carregar a lista.</strong>
          <span>{error}</span>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Controle de presença</p>
          <h1>Lista dos convidados</h1>
          <p className="header-copy">Dados carregados diretamente da landing page pelo Supabase.</p>
        </div>

        <div className="account-actions">
          <span>{email}</span>
          <button type="button" className="ghost-button" onClick={logout} disabled={isLoggingOut}>
            {isLoggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </header>

      <section className="summary-grid" aria-label="Resumo das confirmações">
        <article className="summary-card">
          <span>Pessoas confirmadas</span>
          <strong>{summary.confirmedPeople}</strong>
        </article>
        <article className="summary-card">
          <span>Convites confirmados</span>
          <strong>{summary.confirmedRows}</strong>
        </article>
        <article className="summary-card">
          <span>Pendentes</span>
          <strong>{summary.pendingRows}</strong>
        </article>
        <article className="summary-card">
          <span>Não irão</span>
          <strong>{summary.declinedRows}</strong>
        </article>
      </section>

      <section className="toolbar" aria-label="Filtros da lista">
        <label className="search-field">
          Buscar convidado
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, telefone ou observação"
          />
        </label>

        <div className="status-tabs" role="tablist" aria-label="Status">
          {(["all", "confirmed", "pending", "declined"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={status === item ? "active" : ""}
              onClick={() => setStatus(item)}
            >
              {statusLabels[item]}
            </button>
          ))}
        </div>

        <button type="button" className="secondary-button" onClick={exportCsv}>
          Exportar CSV
        </button>
      </section>

      <section className="guest-list" aria-label="Lista de convidados">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Convidado</th>
                <th>Telefone</th>
                <th>Pessoas</th>
                <th>Status</th>
                <th>Observações</th>
                <th>Enviado em</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.map((guest) => (
                <tr key={guest.id}>
                  <td>
                    <strong>{guest.name}</strong>
                  </td>
                  <td>{guest.phone ?? "-"}</td>
                  <td>{guest.totalPeople > 0 ? guest.totalPeople : "-"}</td>
                  <td>
                    <span className={`status-pill ${statusClasses[guest.status]}`}>{statusLabels[guest.status]}</span>
                  </td>
                  <td>{guest.notes ?? "-"}</td>
                  <td>{formatDate(guest.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredGuests.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhum convidado encontrado.</strong>
              <span>Ajuste a busca ou troque o filtro de status.</span>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
