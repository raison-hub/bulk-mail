import { useEffect, useMemo, useState } from "react";
import * as api from "./api.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const parseEmails = (text) =>
  [...new Set(text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];

/* ---------- Login ---------- */
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token, email: who } = await api.login(email, password);
      localStorage.setItem("token", token);
      localStorage.setItem("email", who);
      onLogin(who);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form onSubmit={submit} className="panel">
        <h1>Bulk Mail</h1>
        <p className="muted">Log in to send and review campaigns.</p>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="msg error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
    </main>
  );
}

/* ---------- Compose ---------- */
function Compose({ onSent, onAuthError }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientText, setRecipientText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const { valid, invalid } = useMemo(() => {
    const all = parseEmails(recipientText);
    return { valid: all.filter((e) => EMAIL_RE.test(e)), invalid: all.filter((e) => !EMAIL_RE.test(e)) };
  }, [recipientText]);

  const canSend = subject.trim() && body.trim() && valid.length && !invalid.length && !busy;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const { message } = await api.sendMail({ subject, body, recipients: valid });
      setNotice({ type: "success", text: message });
      setSubject(""); setBody(""); setRecipientText("");
      onSent();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setNotice({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel compose">
      <label>Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What is this email about?" />
      </label>
      <label>Message
        <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
      </label>
      <label>Recipients
        <textarea
          rows={4}
          value={recipientText}
          onChange={(e) => setRecipientText(e.target.value)}
          placeholder="Paste addresses separated by commas, spaces or new lines"
        />
      </label>
      <p className="muted count">
        {valid.length} valid recipient{valid.length === 1 ? "" : "s"}
        {invalid.length > 0 && (
          <span className="bad"> · Fix {invalid.length} invalid: {invalid.slice(0, 3).join(", ")}{invalid.length > 3 ? "…" : ""}</span>
        )}
      </p>
      {notice && <p className={`msg ${notice.type}`} role="status">{notice.text}</p>}
      <button className="primary" disabled={!canSend}>
        {busy ? `Sending to ${valid.length}…` : `Send to ${valid.length || ""} recipient${valid.length === 1 ? "" : "s"}`}
      </button>
    </form>
  );
}

/* ---------- History ---------- */
function History({ refreshKey, onAuthError }) {
  const [data, setData] = useState({ items: [], pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  const fail = (e) => (e.status === 401 ? onAuthError() : setError(e.message));

  useEffect(() => {
    api.getHistory(page).then(setData).catch(fail);
  }, [page, refreshKey]);

  const toggle = async (id) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    setDetail(null);
    try { setDetail(await api.getMail(id)); } catch (e) { fail(e); }
  };

  if (error) return <p className="msg error">{error}</p>;
  if (!data.items.length) return <p className="panel muted">No emails sent yet. Compose one to get started.</p>;

  return (
    <div className="panel history">
      <ul>
        {data.items.map((m) => (
          <li key={m._id}>
            <button className="row" onClick={() => toggle(m._id)} aria-expanded={open === m._id}>
              <span className={`badge ${m.status}`}>{m.status}</span>
              <span className="subj">{m.subject}</span>
              <span className="muted">{m.sentCount}/{m.recipients.length} delivered</span>
              <time className="muted">{new Date(m.createdAt).toLocaleString()}</time>
            </button>
            {open === m._id && (
              <div className="detail">
                {!detail ? <p className="muted">Loading…</p> : (
                  <>
                    <pre>{detail.body}</pre>
                    <ul className="results">
                      {detail.results.map((r) => (
                        <li key={r.email} className={r.status}>
                          {r.email}: {r.status}{r.error ? ` (${r.error})` : ""}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {data.pages > 1 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

/* ---------- App shell ---------- */
export default function App() {
  const [user, setUser] = useState(localStorage.getItem("token") ? localStorage.getItem("email") : null);
  const [tab, setTab] = useState("compose");
  const [refreshKey, setRefreshKey] = useState(0);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    setUser(null);
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="shell">
      <header>
        <h1>Bulk Mail</h1>
        <nav>
          <button className={tab === "compose" ? "active" : ""} onClick={() => setTab("compose")}>Compose</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button>
        </nav>
        <span className="muted who">{user}</span>
        <button onClick={logout}>Log out</button>
      </header>
      <main>
        {tab === "compose"
          ? <Compose onSent={() => setRefreshKey((k) => k + 1)} onAuthError={logout} />
          : <History refreshKey={refreshKey} onAuthError={logout} />}
      </main>
    </div>
  );
}
