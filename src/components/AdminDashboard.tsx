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

type ParsedNotes = {
  adultNames: string | null;
  childNames: string | null;
  message: string | null;
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

function getSectionValue(notes: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = notes.match(new RegExp(`${escapedLabel}:\\s*([\\s\\S]*?)(?=\\n\\n[A-Za-zÀ-ÿ]+:|$)`, "i"));

  return match?.[1]?.trim() || null;
}

function parseNotes(notes: string | null): ParsedNotes {
  if (!notes) {
    return {
      adultNames: null,
      childNames: null,
      message: null,
    };
  }

  const adultNames = getSectionValue(notes, "Adultos");
  const childNames = getSectionValue(notes, "Crianças");
  const message = getSectionValue(notes, "Mensagem");
  const hasStructuredNotes = adultNames || childNames || message;

  return {
    adultNames,
    childNames,
    message: hasStructuredNotes ? message : notes,
  };
}

function mapRowToGuest(row: RsvpConfirmationRow): RsvpGuest {
  const parsedNotes = parseNotes(row.notes);

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    companions: row.companions,
    status: row.status,
    notes: row.notes,
    adultNames: parsedNotes.adultNames,
    childNames: parsedNotes.childNames,
    message: parsedNotes.message,
    totalPeople: row.total_people ?? (row.status === "confirmed" ? row.companions + 1 : 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function makeCsv(rows: RsvpGuest[]) {
  const headers = [
    "Nome",
    "Telefone",
    "Acompanhantes",
    "Total de pessoas",
    "Status",
    "Adultos",
    "Crianças",
    "Mensagem",
    "Confirmado em",
  ];
  const body = rows.map((guest) => [
    guest.name,
    guest.phone ?? "",
    String(guest.companions),
    String(guest.totalPeople),
    statusLabels[guest.status],
    guest.adultNames ?? "",
    guest.childNames ?? "",
    guest.message ?? "",
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
  const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);
  const [guestPendingDeletion, setGuestPendingDeletion] = useState<RsvpGuest | null>(null);
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
          | { ok: true; rows: RsvpConfirmationRow[]; deletedId?: never }
          | { ok: false; message: string };

        if (!response.ok) {
          setError(payload.ok ? "Não foi possível carregar as confirmações." : payload.message);
          return;
        }

        if (!payload.ok) {
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
      const searchableContent = `${guest.name} ${guest.phone ?? ""} ${guest.adultNames ?? ""} ${
        guest.childNames ?? ""
      } ${guest.message ?? ""}`;
      const matchesSearch = !search || normalize(searchableContent).includes(search);

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

  async function deleteGuest(guest: RsvpGuest) {
    setDeletingGuestId(guest.id);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        await router.replace("/login");
        return;
      }

      const response = await fetch(`/api/rsvps?id=${encodeURIComponent(guest.id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const payload = (await response.json()) as
        | { ok: true; deletedId: string; rows?: never }
        | { ok: false; message: string };

      if (!response.ok) {
        setError(payload.ok ? "Não foi possível excluir o registro." : payload.message);
        return;
      }

      if (!payload.ok) {
        setError(payload.message);
        return;
      }

      setGuests((currentGuests) => currentGuests.filter((currentGuest) => currentGuest.id !== payload.deletedId));
      setGuestPendingDeletion(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o registro.");
    } finally {
      setDeletingGuestId(null);
    }
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
          <span>Estamos consultando os dados salvos da lista de presença.</span>
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
          <p className="header-copy">Dados carregados diretamente das confirmações da landing page.</p>
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
          <table className="guest-table">
            <colgroup>
              <col className="col-guest" />
              <col className="col-phone" />
              <col className="col-people" />
              <col className="col-status" />
              <col className="col-adults" />
              <col className="col-children" />
              <col className="col-message" />
              <col className="col-date" />
              <col className="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Convidado</th>
                <th>Telefone</th>
                <th>Pessoas</th>
                <th>Status</th>
                <th>Adultos</th>
                <th>Crianças</th>
                <th>Mensagem</th>
                <th>Enviado em</th>
                <th>Ações</th>
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
                  <td className="text-cell">{guest.adultNames ?? "-"}</td>
                  <td className="text-cell">{guest.childNames ?? "-"}</td>
                  <td className="text-cell">{guest.message ?? "-"}</td>
                  <td>{formatDate(guest.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => setGuestPendingDeletion(guest)}
                      disabled={deletingGuestId === guest.id}
                    >
                      {deletingGuestId === guest.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))}

              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-table-cell">
                    <div className="empty-state">
                      <strong>Nenhum convidado encontrado.</strong>
                      <span>Ajuste a busca ou troque o filtro de status.</span>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="guest-card-list">
          {filteredGuests.map((guest) => (
            <article className="guest-card" key={guest.id}>
              <div className="guest-card-header">
                <div>
                  <span>Convidado</span>
                  <strong>{guest.name}</strong>
                </div>
                <span className={`status-pill ${statusClasses[guest.status]}`}>{statusLabels[guest.status]}</span>
              </div>

              <dl className="guest-card-grid">
                <div>
                  <dt>Telefone</dt>
                  <dd>{guest.phone ?? "-"}</dd>
                </div>
                <div>
                  <dt>Pessoas</dt>
                  <dd>{guest.totalPeople > 0 ? guest.totalPeople : "-"}</dd>
                </div>
                <div>
                  <dt>Adultos</dt>
                  <dd>{guest.adultNames ?? "-"}</dd>
                </div>
                <div>
                  <dt>Crianças</dt>
                  <dd>{guest.childNames ?? "-"}</dd>
                </div>
                <div>
                  <dt>Mensagem</dt>
                  <dd>{guest.message ?? "-"}</dd>
                </div>
                <div>
                  <dt>Enviado em</dt>
                  <dd>{formatDate(guest.createdAt)}</dd>
                </div>
              </dl>

              <button
                type="button"
                className="danger-button"
                onClick={() => setGuestPendingDeletion(guest)}
                disabled={deletingGuestId === guest.id}
              >
                {deletingGuestId === guest.id ? "Excluindo..." : "Excluir registro"}
              </button>
            </article>
          ))}

          {filteredGuests.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhum convidado encontrado.</strong>
              <span>Ajuste a busca ou troque o filtro de status.</span>
            </div>
          ) : null}
        </div>
      </section>

      {guestPendingDeletion ? (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={() => {
            if (deletingGuestId !== guestPendingDeletion.id) {
              setGuestPendingDeletion(null);
            }
          }}
        >
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Excluir confirmação</p>
            <h2 id="delete-modal-title">Remover este registro?</h2>
            <p>
              A confirmação de <strong>{guestPendingDeletion.name}</strong> será removida da lista de presença.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setGuestPendingDeletion(null)}
                disabled={deletingGuestId === guestPendingDeletion.id}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => deleteGuest(guestPendingDeletion)}
                disabled={deletingGuestId === guestPendingDeletion.id}
              >
                {deletingGuestId === guestPendingDeletion.id ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
