import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { createNote, deleteNote, listNotes, updateNote } from "./api/notesApi";
import { formatDateTime } from "./utils/ui";

function safeString(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function noteIdOf(note) {
  return note?.id ?? note?._id ?? note?.noteId ?? note?.uuid ?? null;
}

function noteTitleOf(note) {
  return safeString(note?.title || "Untitled");
}

function noteContentOf(note) {
  return safeString(note?.content || "");
}

function noteUpdatedAtOf(note) {
  return note?.updatedAt ?? note?.updated_at ?? note?.modifiedAt ?? note?.modified_at ?? note?.createdAt ?? note?.created_at;
}

function applyNotePatch(existing, patch) {
  return {
    ...existing,
    ...patch,
  };
}

function sortNotesNewestFirst(items) {
  const arr = Array.isArray(items) ? [...items] : [];
  arr.sort((a, b) => {
    const da = new Date(noteUpdatedAtOf(a) || 0).getTime();
    const db = new Date(noteUpdatedAtOf(b) || 0).getTime();
    return db - da;
  });
  return arr;
}

function normalizeListResponse(resp) {
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === "object") {
    if (Array.isArray(resp.items)) return resp.items;
    if (Array.isArray(resp.notes)) return resp.notes;
    if (Array.isArray(resp.data)) return resp.data;
  }
  return [];
}

function normalizeNoteResponse(resp) {
  if (!resp) return null;
  if (resp && typeof resp === "object") {
    if (resp.note && typeof resp.note === "object") return resp.note;
    if (resp.data && typeof resp.data === "object") return resp.data;
    return resp;
  }
  return null;
}

function matchesQuery(note, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = noteTitleOf(note).toLowerCase();
  const c = noteContentOf(note).toLowerCase();
  return t.includes(q) || c.includes(q);
}

// PUBLIC_INTERFACE
function App() {
  /** Notes manager application. Two-pane layout with notes list and editor, with CRUD via backend API. */
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // editor state
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const titleInputRef = useRef(null);

  const selectedNote = useMemo(() => notes.find((n) => noteIdOf(n) === selectedId) || null, [notes, selectedId]);

  const filteredNotes = useMemo(() => {
    return sortNotesNewestFirst(notes).filter((n) => matchesQuery(n, query));
  }, [notes, query]);

  const canDelete = Boolean(selectedNote && noteIdOf(selectedNote));
  const canSave = isDirty && !isSaving;

  function setTransientInfo(msg) {
    setInfo(msg);
    window.setTimeout(() => setInfo(""), 2500);
  }

  function setTransientError(msg) {
    setError(msg);
    window.setTimeout(() => setError(""), 4500);
  }

  async function refreshList({ preserveSelection = true } = {}) {
    setIsLoading(true);
    setError("");
    try {
      const resp = await listNotes();
      const items = normalizeListResponse(resp);
      const sorted = sortNotesNewestFirst(items);
      setNotes(sorted);

      if (!preserveSelection) {
        setSelectedId(null);
      } else if (selectedId != null && !sorted.some((n) => noteIdOf(n) === selectedId)) {
        setSelectedId(null);
      }
    } catch (e) {
      setTransientError(e?.message || "Failed to load notes.");
    } finally {
      setIsLoading(false);
    }
  }

  function loadDraftFromNote(note) {
    setDraftTitle(noteTitleOf(note));
    setDraftContent(noteContentOf(note));
    setIsDirty(false);
  }

  function selectNote(note) {
    const id = noteIdOf(note);
    if (!id) return;

    // Minimal protection against accidental switching away with unsaved changes.
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Discard them and switch notes?");
      if (!ok) return;
    }

    setSelectedId(id);
    loadDraftFromNote(note);
  }

  // initial load
  useEffect(() => {
    refreshList({ preserveSelection: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when selection changes from outside (e.g., after create), sync draft
  useEffect(() => {
    if (selectedNote) {
      loadDraftFromNote(selectedNote);
    } else {
      setDraftTitle("");
      setDraftContent("");
      setIsDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function onCreateNew() {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Discard them and create a new note?");
      if (!ok) return;
    }

    setIsSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const payload = { title: "Untitled", content: "" };
      const resp = await createNote(payload);
      const created = normalizeNoteResponse(resp) || { ...payload, createdAt: now, updatedAt: now };

      const createdId = noteIdOf(created);
      if (!createdId) {
        // fallback: refresh list to discover id
        await refreshList({ preserveSelection: false });
        setTransientInfo("Note created.");
        return;
      }

      setNotes((prev) => sortNotesNewestFirst([created, ...prev.filter((n) => noteIdOf(n) !== createdId)]));
      setSelectedId(createdId);
      setTransientInfo("Note created.");

      window.setTimeout(() => titleInputRef.current?.focus?.(), 0);
    } catch (e) {
      setTransientError(e?.message || "Failed to create note.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onSave() {
    if (!selectedNote) return;
    const id = noteIdOf(selectedNote);
    if (!id) return;

    setIsSaving(true);
    setError("");
    try {
      const payload = {
        title: draftTitle.trim() ? draftTitle : "Untitled",
        content: draftContent,
      };
      const resp = await updateNote(id, payload);
      const updated = normalizeNoteResponse(resp) || applyNotePatch(selectedNote, payload);

      setNotes((prev) => prev.map((n) => (noteIdOf(n) === id ? applyNotePatch(n, updated) : n)));
      setIsDirty(false);
      setTransientInfo("Saved.");
    } catch (e) {
      setTransientError(e?.message || "Failed to save note.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onDelete() {
    if (!selectedNote) return;
    const id = noteIdOf(selectedNote);
    if (!id) return;

    const ok = window.confirm(`Delete "${noteTitleOf(selectedNote)}"? This cannot be undone.`);
    if (!ok) return;

    setIsSaving(true);
    setError("");
    try {
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => noteIdOf(n) !== id));
      setSelectedId(null);
      setDraftTitle("");
      setDraftContent("");
      setIsDirty(false);
      setTransientInfo("Deleted.");
    } catch (e) {
      setTransientError(e?.message || "Failed to delete note.");
    } finally {
      setIsSaving(false);
    }
  }

  function onChangeTitle(v) {
    setDraftTitle(v);
    setIsDirty(true);
  }

  function onChangeContent(v) {
    setDraftContent(v);
    setIsDirty(true);
  }

  function onKeyDownEditor(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (canSave) onSave();
    }
  }

  return (
    <div className="NotesApp">
      <header className="AppTopbar">
        <div className="TopbarLeft">
          <div className="Brand">
            <div className="BrandMark" aria-hidden="true">
              N
            </div>
            <div>
              <div className="BrandTitle">Notes</div>
              <div className="BrandSubtitle">Lightweight manager</div>
            </div>
          </div>
        </div>

        <div className="TopbarRight">
          <div className="StatusPills" aria-live="polite">
            {isSaving ? <span className="Pill pillInfo">Saving…</span> : null}
            {isDirty && !isSaving ? <span className="Pill pillWarn">Unsaved</span> : null}
            {info ? <span className="Pill pillOk">{info}</span> : null}
            {error ? <span className="Pill pillErr">{error}</span> : null}
          </div>

          <div className="TopbarActions">
            <button className="Btn BtnPrimary" onClick={onCreateNew} disabled={isSaving}>
              New note
            </button>
            <button className="Btn" onClick={onSave} disabled={!canSave}>
              Save
              <span className="BtnHint">Ctrl/⌘S</span>
            </button>
            <button className="Btn BtnDanger" onClick={onDelete} disabled={!canDelete || isSaving}>
              Delete
            </button>
          </div>
        </div>
      </header>

      <main className="AppShell">
        <aside className="Sidebar" aria-label="Notes list">
          <div className="SidebarHeader">
            <div className="SidebarTitle">Your notes</div>
            <div className="SidebarMeta">{isLoading ? "Loading…" : `${notes.length} total`}</div>
          </div>

          <div className="SidebarSearch">
            <input
              className="Input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              aria-label="Search notes"
            />
          </div>

          <div className="NotesList" role="list">
            {filteredNotes.length === 0 ? (
              <div className="EmptyState">
                <div className="EmptyTitle">{query.trim() ? "No matches" : "No notes yet"}</div>
                <div className="EmptyDesc">{query.trim() ? "Try a different search." : "Create your first note to get started."}</div>
                {!query.trim() ? (
                  <button className="Btn BtnPrimary" onClick={onCreateNew} disabled={isSaving}>
                    Create a note
                  </button>
                ) : null}
              </div>
            ) : (
              filteredNotes.map((n) => {
                const id = noteIdOf(n);
                const active = id === selectedId;
                const updated = noteUpdatedAtOf(n);
                const preview = noteContentOf(n).replace(/\s+/g, " ").trim();

                return (
                  <button key={id} className={`NoteRow ${active ? "active" : ""}`} onClick={() => selectNote(n)} role="listitem">
                    <div className="NoteRowTop">
                      <div className="NoteRowTitle">{noteTitleOf(n)}</div>
                      {updated ? <div className="NoteRowTime">{formatDateTime(updated)}</div> : null}
                    </div>
                    <div className="NoteRowPreview">{preview || "—"}</div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="EditorPane" aria-label="Note editor" onKeyDown={onKeyDownEditor}>
          {!selectedNote ? (
            <div className="EditorEmpty">
              <div className="EditorEmptyCard">
                <div className="EditorEmptyTitle">Select a note</div>
                <div className="EditorEmptyDesc">Choose a note from the list, or create a new one.</div>
                <button className="Btn BtnPrimary" onClick={onCreateNew} disabled={isSaving}>
                  New note
                </button>
              </div>
            </div>
          ) : (
            <div className="Editor">
              <div className="EditorHeader">
                <input
                  ref={titleInputRef}
                  className="TitleInput"
                  value={draftTitle}
                  onChange={(e) => onChangeTitle(e.target.value)}
                  placeholder="Title"
                  aria-label="Note title"
                />
                <div className="EditorMeta">
                  {noteUpdatedAtOf(selectedNote) ? (
                    <span className="MetaText">Updated {formatDateTime(noteUpdatedAtOf(selectedNote))}</span>
                  ) : (
                    <span className="MetaText"> </span>
                  )}
                </div>
              </div>

              <textarea
                className="ContentInput"
                value={draftContent}
                onChange={(e) => onChangeContent(e.target.value)}
                placeholder="Write your note…"
                aria-label="Note content"
              />

              <div className="EditorFooter">
                <div className="FooterLeft">
                  <span className="FooterHint">Tip: Ctrl/⌘S to save</span>
                </div>
                <div className="FooterRight">
                  <button className="Btn" onClick={() => refreshList({ preserveSelection: true })} disabled={isSaving || isLoading}>
                    Refresh
                  </button>
                  <button className="Btn BtnPrimary" onClick={onSave} disabled={!canSave}>
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
