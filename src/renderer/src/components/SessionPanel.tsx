import { useState, useSyncExternalStore } from "react";
import { getApi } from "../lib/api";
import { emitWorkspaceChanged } from "../lib/bus";
import { session } from "../lib/session";

export function SessionPanel() {
  const api = getApi();
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const [open, setOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const startSession = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await session.start();
    } catch {
      setMessage("Could not start a session on this network.");
    } finally {
      setBusy(false);
    }
  };

  const joinSession = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await session.join(joinCode);
      setJoinCode("");
    } catch {
      setMessage("That code did not work. Check it and try again.");
    } finally {
      setBusy(false);
    }
  };

  const leaveSession = async () => {
    setBusy(true);
    try {
      await session.stop();
      setMessage(null);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (state.code) {
      void navigator.clipboard.writeText(state.code).then(() => setMessage("Code copied"));
    }
  };

  const exportBundle = async () => {
    setBusy(true);
    try {
      const result = await api.sync.exportBundle();
      setMessage(result.ok ? "Bundle exported" : null);
    } finally {
      setBusy(false);
    }
  };

  const importBundle = async () => {
    setBusy(true);
    try {
      const result = await api.sync.importBundle();
      if (result.ok) {
        emitWorkspaceChanged();
        setMessage(`Merged ${result.applied} updates`);
      }
    } finally {
      setBusy(false);
    }
  };

  const statusLabel =
    state.status === "solo" ? "Live" : state.status === "hosting" ? "Hosting" : "In session";

  return (
    <div className="session">
      <button
        type="button"
        className="session__pill"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className={state.status === "solo" ? "session__dot" : "session__dot session__dot--live"}
          aria-hidden="true"
        />
        {statusLabel}
      </button>

      {open ? (
        <div className="session__panel">
          {state.status === "solo" ? (
            <>
              <button
                type="button"
                className="btn-primary session__start"
                onClick={startSession}
                disabled={busy}
              >
                Start a session
              </button>
              <p className="session__hint">Or join one with a code from a friend on your network.</p>
              <div className="session__join">
                <input
                  className="session__input"
                  placeholder="PG1…"
                  aria-label="Join code"
                  value={joinCode}
                  spellCheck={false}
                  onChange={(event) => setJoinCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && joinCode.trim().length > 0 && !busy) {
                      void joinSession();
                    }
                  }}
                />
                <button
                  type="button"
                  className="ghost-btn ghost-btn--small"
                  onClick={() => void joinSession()}
                  disabled={busy || joinCode.trim().length === 0}
                >
                  Join
                </button>
              </div>
            </>
          ) : (
            <>
              {state.status === "hosting" ? (
                <>
                  <p className="session__hint">Friends on this network can join with this code:</p>
                  <button
                    type="button"
                    className="session__code"
                    data-testid="session-code"
                    title="Click to copy"
                    onClick={copyCode}
                  >
                    {state.code}
                  </button>
                </>
              ) : (
                <p className="session__hint">You are in a shared session.</p>
              )}
              <div className="session__peers">
                {state.peers.length === 0 ? (
                  <span className="session__hint">Waiting for others…</span>
                ) : (
                  state.peers.map((peer) => (
                    <span key={`${peer.name}-${peer.color}`} className="session__peer">
                      <span
                        className="session__peer-dot"
                        style={{ backgroundColor: peer.color }}
                        aria-hidden="true"
                      />
                      {peer.name}
                    </span>
                  ))
                )}
              </div>
              <button
                type="button"
                className="ghost-btn ghost-btn--small"
                onClick={() => void leaveSession()}
                disabled={busy}
              >
                {state.status === "hosting" ? "Stop session" : "Leave session"}
              </button>
            </>
          )}

          <div className="session__fallback">
            <button type="button" className="session__link" onClick={() => void exportBundle()} disabled={busy}>
              Export .sync
            </button>
            <button type="button" className="session__link" onClick={() => void importBundle()} disabled={busy}>
              Import .sync
            </button>
          </div>

          {message ? <p className="session__message">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
