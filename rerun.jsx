import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, Sparkles, BarChart3, Plus, Check, ChevronLeft, ChevronDown, X,
  Clock, Tv, Film, Loader2, Heart, Star, Trash2, LayoutGrid, List as ListIcon,
  Monitor, MoreHorizontal, Ban, Award, Flame, CheckCircle2, Compass, Eye
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip
} from "recharts";

const STORAGE_KEY = "rerun-data-v2";
const API = "https://api.tvmaze.com";
const GENRE_COLORS = ["#FFB238", "#4FD8C4", "#FF5C5C", "#8B7FE8", "#6FCF97", "#F2994A", "#56CCF2"];
const MOODS = [
  { key: "shocked", label: "Shocked", emoji: "😵" },
  { key: "frustrated", label: "Frustrated", emoji: "😤" },
  { key: "sad", label: "Sad", emoji: "😢" },
  { key: "reflective", label: "Reflective", emoji: "🤔" },
  { key: "touched", label: "Touched", emoji: "🥹" },
  { key: "amused", label: "Amused", emoji: "😆" },
  { key: "scared", label: "Scared", emoji: "😱" },
  { key: "bored", label: "Bored", emoji: "😑" },
  { key: "understood", label: "Understood", emoji: "😌" },
  { key: "thrilled", label: "Thrilled", emoji: "🤩" },
  { key: "confused", label: "Confused", emoji: "😕" },
  { key: "tense", label: "Tense", emoji: "😬" }
];
const RATING_LABELS = ["Bad", "OK", "Good", "Great", "Wow"];
const SHOW_WHERE = ["TV", "Streaming", "Other", "Unofficial"];
const MOVIE_WHERE = ["Theater", "Streaming", "Other", "Unofficial"];

function stripHtml(s) { return s ? s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : ""; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""; }
function epCode(s, n) { return `S${String(s).padStart(2, "0")} | E${String(n).padStart(2, "0")}`; }
function daysAgo(ts) { return Math.floor((Date.now() - ts) / 86400000); }
function dayBucket(dateStr) {
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "TODAY";
  if (diff === 1) return "TOMORROW";
  if (diff === -1) return "YESTERDAY";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}
function formatWatchTime(totalMinutes) {
  let hours = Math.floor(totalMinutes / 60);
  const months = Math.floor(hours / (24 * 30)); hours -= months * 24 * 30;
  const days = Math.floor(hours / 24); hours -= days * 24;
  return { months, days, hours };
}
async function tvFetch(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`TVmaze error ${res.status}`);
  return res.json();
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function Rerun() {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState({ shows: {}, watchedLog: {}, movies: {} });
  const [episodesCache, setEpisodesCache] = useState({});
  const [castCache, setCastCache] = useState({});
  const [nav, setNav] = useState("shows");
  const [detail, setDetail] = useState(null); // {type:'show'|'episode'|'movie', showId, episodeId, movieId}

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) setData(JSON.parse(res.value));
      } catch (e) {}
      finally { setLoaded(true); }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setData(next);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(next), false); }
    catch (e) { console.error("save failed", e); }
  }, []);

  const ensureEpisodes = useCallback(async (showId) => {
    if (episodesCache[showId]) return episodesCache[showId];
    try {
      const full = await tvFetch(`/shows/${showId}?embed=episodes`);
      const eps = (full._embedded?.episodes || []).filter(e => e.season > 0);
      setEpisodesCache(prev => ({ ...prev, [showId]: eps }));
      return eps;
    } catch (e) { return []; }
  }, [episodesCache]);

  const ensureCast = useCallback(async (showId) => {
    if (castCache[showId]) return castCache[showId];
    try {
      const cast = await tvFetch(`/shows/${showId}/cast`);
      setCastCache(prev => ({ ...prev, [showId]: cast }));
      return cast;
    } catch (e) { return []; }
  }, [castCache]);

  useEffect(() => {
    if (!loaded) return;
    Object.keys(data.shows).forEach(id => { ensureEpisodes(id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, data.shows]);

  const addShow = (show) => {
    if (data.shows[show.id]) return;
    persist({ ...data, shows: { ...data.shows, [show.id]: {
      id: show.id, name: show.name, image: show.image?.medium || null,
      genres: show.genres || [], status: show.status, premiered: show.premiered,
      network: show.network?.name || show.webChannel?.name || null, addedAt: Date.now()
    }}});
  };
  const removeShow = (id) => {
    const shows = { ...data.shows }; delete shows[id];
    const watchedLog = { ...data.watchedLog };
    Object.keys(watchedLog).forEach(k => { if (watchedLog[k].showId === id) delete watchedLog[k]; });
    persist({ ...data, shows, watchedLog });
  };

  const toggleEpisodeWatched = (show, ep, extra = {}) => {
    const next = { ...data, watchedLog: { ...data.watchedLog } };
    const existing = next.watchedLog[ep.id];
    if (existing && !Object.keys(extra).length) {
      delete next.watchedLog[ep.id];
    } else {
      next.watchedLog[ep.id] = {
        watchedAt: existing?.watchedAt || Date.now(), showId: show.id, showName: show.name,
        season: ep.season, number: ep.number, runtime: ep.runtime || 42,
        genres: show.genres || [], rating: existing?.rating || null,
        mood: existing?.mood || null, whereWatched: existing?.whereWatched || null,
        ...extra
      };
    }
    persist(next);
  };

  const setSeasonWatched = (show, seasonEps, watched) => {
    const next = { ...data, watchedLog: { ...data.watchedLog } };
    seasonEps.forEach(ep => {
      if (watched) {
        if (!next.watchedLog[ep.id]) {
          next.watchedLog[ep.id] = {
            watchedAt: Date.now(), showId: show.id, showName: show.name,
            season: ep.season, number: ep.number, runtime: ep.runtime || 42,
            genres: show.genres || [], rating: null, mood: null, whereWatched: null
          };
        }
      } else delete next.watchedLog[ep.id];
    });
    persist(next);
  };

  const addMovie = (movie) => {
    const id = uid();
    persist({ ...data, movies: { ...data.movies, [id]: {
      id, title: movie.title, genres: movie.genres, runtime: movie.runtime || 120,
      releaseDate: movie.releaseDate || null, addedAt: Date.now(),
      watchedAt: null, favorite: false, rating: null, mood: null, whereWatched: null
    }}});
  };
  const updateMovie = (id, patch) => {
    persist({ ...data, movies: { ...data.movies, [id]: { ...data.movies[id], ...patch } } });
  };
  const removeMovie = (id) => {
    const movies = { ...data.movies }; delete movies[id];
    persist({ ...data, movies });
  };

  if (!loaded) {
    return <div className="rr-root rr-loading"><Style /><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="rr-root">
      <Style />
      <div className="rr-frame">
        <div className="rr-content">
          {!detail && nav === "shows" && (
            <ShowsHome data={data} episodesCache={episodesCache}
              onOpenShow={(id) => setDetail({ type: "show", showId: id })}
              onQuickWatch={toggleEpisodeWatched} />
          )}
          {!detail && nav === "movies" && (
            <MoviesHome data={data}
              onOpenMovie={(id) => setDetail({ type: "movie", movieId: id })}
              onAddMovie={addMovie} onQuickWatch={(m) => updateMovie(m.id, { watchedAt: m.watchedAt ? null : Date.now() })} />
          )}
          {!detail && nav === "explore" && (
            <ExploreHome data={data} onOpenShow={(id) => setDetail({ type: "show", showId: id })} onAddShow={addShow} />
          )}
          {!detail && nav === "stats" && <StatsView data={data} episodesCache={episodesCache} />}
          {!detail && nav === "ai" && <AIView data={data} onOpenExplore={() => setNav("explore")} />}

          {detail?.type === "show" && (
            <ShowDetail
              showId={detail.showId} data={data} episodesCache={episodesCache} castCache={castCache}
              ensureEpisodes={ensureEpisodes} ensureCast={ensureCast}
              onBack={() => setDetail(null)}
              onAddShow={addShow} onRemoveShow={removeShow}
              onToggleEp={toggleEpisodeWatched} onSetSeasonWatched={setSeasonWatched}
              onOpenEpisode={(showId, episodeId) => setDetail({ type: "episode", showId, episodeId })}
            />
          )}
          {detail?.type === "episode" && (
            <EpisodeDetail
              showId={detail.showId} episodeId={detail.episodeId} data={data} episodesCache={episodesCache}
              onBack={() => setDetail({ type: "show", showId: detail.showId })}
              onSave={toggleEpisodeWatched}
            />
          )}
          {detail?.type === "movie" && (
            <MovieDetail movie={data.movies[detail.movieId]} onBack={() => setDetail(null)}
              onUpdate={(patch) => updateMovie(detail.movieId, patch)}
              onDelete={() => { removeMovie(detail.movieId); setDetail(null); }} />
          )}
        </div>
        {!detail && (
          <nav className="rr-nav">
            <NavBtn icon={Tv} label="Shows" active={nav === "shows"} onClick={() => setNav("shows")} />
            <NavBtn icon={Film} label="Movies" active={nav === "movies"} onClick={() => setNav("movies")} />
            <NavBtn icon={Compass} label="Explore" active={nav === "explore"} onClick={() => setNav("explore")} />
            <NavBtn icon={BarChart3} label="Stats" active={nav === "stats"} onClick={() => setNav("stats")} />
            <NavBtn icon={Sparkles} label="AI" active={nav === "ai"} onClick={() => setNav("ai")} />
          </nav>
        )}
      </div>
    </div>
  );
}

function NavBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button className={`rr-navbtn ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={19} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span>
    </button>
  );
}
function EmptyState({ icon: Icon, text, sub }) {
  return (
    <div className="rr-empty">
      <Icon size={26} strokeWidth={1.5} />
      <div className="rr-empty-text">{text}</div>
      {sub && <div className="rr-empty-sub">{sub}</div>}
    </div>
  );
}
function Pill({ children }) { return <span className="rr-pill">{children}</span>; }

/* ============ SHOWS HOME (Watch List / Upcoming) ============ */
function ShowsHome({ data, episodesCache, onOpenShow, onQuickWatch }) {
  const [tab, setTab] = useState("list");
  const [grid, setGrid] = useState(false);
  const shows = Object.values(data.shows);

  const groups = useMemo(() => {
    const history = [];
    const watchNext = [];
    const stale = [];
    const notStarted = [];
    shows.forEach(show => {
      const eps = (episodesCache[show.id] || []).slice().sort((a, b) => a.season - b.season || a.number - b.number);
      const watchedEps = eps.filter(e => data.watchedLog[e.id]);
      const hasStarted = watchedEps.length > 0;
      const now = Date.now();
      const nextEp = eps.find(e => e.airstamp && new Date(e.airstamp).getTime() <= now && !data.watchedLog[e.id]);
      const remaining = eps.filter(e => e.airstamp && new Date(e.airstamp).getTime() <= now && !data.watchedLog[e.id]).length;
      const lastWatchedAt = watchedEps.length ? Math.max(...watchedEps.map(e => data.watchedLog[e.id].watchedAt)) : 0;

      if (!hasStarted) { notStarted.push({ show, nextEp: eps[0], remaining: eps.length }); return; }
      if (nextEp) {
        const item = { show, nextEp, remaining: remaining - 1, lastWatchedAt };
        if (daysAgo(lastWatchedAt) <= 10) watchNext.push(item); else stale.push(item);
      }
    });
    Object.values(data.watchedLog).sort((a, b) => b.watchedAt - a.watchedAt).slice(0, 8).forEach(entry => {
      history.push(entry);
    });
    watchNext.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
    stale.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
    notStarted.sort((a, b) => b.show.addedAt - a.show.addedAt);
    return { history, watchNext, stale, notStarted };
  }, [shows, episodesCache, data.watchedLog]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const items = [];
    shows.forEach(show => {
      (episodesCache[show.id] || []).forEach(ep => {
        if (ep.airstamp && new Date(ep.airstamp).getTime() > now - 86400000) {
          items.push({ show, ep, ts: new Date(ep.airstamp).getTime() });
        }
      });
    });
    items.sort((a, b) => a.ts - b.ts);
    return items.slice(0, 40);
  }, [shows, episodesCache]);

  return (
    <div className="rr-view">
      <header className="rr-header"><div className="rr-logo">RERUN<span className="rr-dot">•</span></div></header>
      <div className="rr-segment">
        <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>Watch List</button>
        <button className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>Upcoming</button>
      </div>

      {tab === "list" && (
        shows.length === 0 ? (
          <EmptyState icon={Tv} text="No shows yet." sub="Head to Explore to search and add shows." />
        ) : (
          <>
            <div className="rr-listtop">
              <span />
              <button className="rr-iconbtn" onClick={() => setGrid(g => !g)}>
                {grid ? <ListIcon size={15} /> : <LayoutGrid size={15} />}
              </button>
            </div>
            {groups.history.length > 0 && (
              <GroupSection label="Watched history" grid={grid}>
                {groups.history.map(entry => (
                  <ShowRow key={entry.showId + entry.watchedAt} grid={grid}
                    show={data.shows[entry.showId]} image={data.shows[entry.showId]?.image}
                    code={epCode(entry.season, entry.number)} title="" watched
                    onOpen={() => onOpenShow(entry.showId)} />
                ))}
              </GroupSection>
            )}
            {groups.watchNext.length > 0 && (
              <GroupSection label="Watch next" grid={grid}>
                {groups.watchNext.map(({ show, nextEp, remaining }) => (
                  <ShowRow key={show.id} grid={grid} show={show} image={show.image}
                    code={epCode(nextEp.season, nextEp.number)} plus={remaining} title={nextEp.name}
                    onOpen={() => onOpenShow(show.id)}
                    onQuick={() => onQuickWatch(show, nextEp)} />
                ))}
              </GroupSection>
            )}
            {groups.stale.length > 0 && (
              <GroupSection label="Haven't watched for a while" grid={grid}>
                {groups.stale.map(({ show, nextEp, remaining }) => (
                  <ShowRow key={show.id} grid={grid} show={show} image={show.image}
                    code={epCode(nextEp.season, nextEp.number)} plus={remaining} title={nextEp.name}
                    onOpen={() => onOpenShow(show.id)}
                    onQuick={() => onQuickWatch(show, nextEp)} />
                ))}
              </GroupSection>
            )}
            {groups.notStarted.length > 0 && (
              <GroupSection label="Haven't started" grid={grid}>
                {groups.notStarted.map(({ show, nextEp, remaining }) => (
                  <ShowRow key={show.id} grid={grid} show={show} image={show.image}
                    code={nextEp ? epCode(nextEp.season, nextEp.number) : ""} plus={remaining > 1 ? remaining - 1 : 0}
                    title={nextEp?.name || ""} onOpen={() => onOpenShow(show.id)}
                    onQuick={nextEp ? () => onQuickWatch(show, nextEp) : null} />
                ))}
              </GroupSection>
            )}
          </>
        )
      )}

      {tab === "upcoming" && (
        upcoming.length === 0 ? (
          <EmptyState icon={Clock} text="Nothing scheduled." sub="Add shows to see their upcoming episodes here." />
        ) : (
          Object.entries(upcoming.reduce((acc, item) => {
            const b = dayBucket(item.ep.airdate); acc[b] = acc[b] || []; acc[b].push(item); return acc;
          }, {})).map(([bucket, items]) => (
            <div key={bucket}>
              <div className="rr-bucket"><Pill>{bucket}</Pill></div>
              {items.map(({ show, ep }) => {
                const aired = ep.airstamp && new Date(ep.airstamp).getTime() <= Date.now();
                const premiere = ep.season === 1 && ep.number === 1;
                return (
                  <ShowRow key={ep.id} show={show} image={show.image}
                    code={epCode(ep.season, ep.number)} title={ep.name}
                    badge={premiere ? "PREMIERE" : (aired ? "AIRED" : "NEW")}
                    watched={!!data.watchedLog[ep.id]}
                    onOpen={() => onOpenShow(show.id)}
                    onQuick={!data.watchedLog[ep.id] ? () => onQuickWatch(show, ep) : null} />
                );
              })}
            </div>
          ))
        )
      )}
    </div>
  );
}

function GroupSection({ label, grid, children }) {
  return (
    <div className="rr-group">
      <div className="rr-bucket"><Pill>{label.toUpperCase()}</Pill></div>
      <div className={grid ? "rr-postergrid" : "rr-rowlist"}>{children}</div>
    </div>
  );
}

function ShowRow({ show, image, code, title, plus, badge, watched, grid, onOpen, onQuick }) {
  if (!show) return null;
  if (grid) {
    return (
      <button className="rr-posteritem" onClick={onOpen}>
        <div className="rr-poster tall">{image ? <img src={image} alt={show.name} /> : <Tv size={18} />}</div>
      </button>
    );
  }
  return (
    <div className="rr-listrow2">
      <button className="rr-listrow2-main" onClick={onOpen}>
        <div className="rr-poster small">{image ? <img src={image} alt={show.name} /> : <Tv size={16} />}</div>
        <div className="rr-listrow2-info">
          <div className="rr-listrow2-tag">{show.name} <ChevronDown size={11} className="rr-tag-chev" /></div>
          <div className="rr-listrow2-code">{code}{plus > 0 && <span className="rr-plus">+{plus}</span>}</div>
          {title && <div className="rr-listrow2-title">{title}</div>}
          {badge && <span className={`rr-badge ${badge.toLowerCase()}`}>{badge}</span>}
        </div>
      </button>
      <button className={`rr-check ${watched ? "on" : ""}`} onClick={onQuick} disabled={!onQuick}>
        <Check size={15} />
      </button>
    </div>
  );
}

/* ============ MOVIES HOME ============ */
function MoviesHome({ data, onOpenMovie, onAddMovie, onQuickWatch }) {
  const [tab, setTab] = useState("list");
  const [showAdd, setShowAdd] = useState(false);
  const movies = Object.values(data.movies);

  const watchNext = movies.filter(m => !m.watchedAt).sort((a, b) => b.addedAt - a.addedAt);
  const history = movies.filter(m => m.watchedAt).sort((a, b) => b.watchedAt - a.watchedAt);
  const upcoming = movies.filter(m => m.releaseDate && new Date(m.releaseDate).getTime() > Date.now() - 86400000)
    .sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));

  return (
    <div className="rr-view">
      <header className="rr-header">
        <div className="rr-title">Movies</div>
        <button className="rr-addbtn" onClick={() => setShowAdd(true)}><Plus size={16} /></button>
      </header>

      {showAdd && <AddMovieForm onClose={() => setShowAdd(false)} onAdd={(m) => { onAddMovie(m); setShowAdd(false); }} />}

      <div className="rr-segment">
        <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>Watch List</button>
        <button className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>Upcoming</button>
      </div>

      {tab === "list" && (
        movies.length === 0 ? (
          <EmptyState icon={Film} text="No movies added." sub="Tap + to add a movie you want to track." />
        ) : (
          <>
            {watchNext.length > 0 && (
              <div className="rr-group">
                <div className="rr-bucket"><Pill>WATCH NEXT</Pill></div>
                <div className="rr-rowlist">
                  {watchNext.map(m => (
                    <MovieRow key={m.id} movie={m} onOpen={() => onOpenMovie(m.id)} onQuick={() => onQuickWatch(m)} />
                  ))}
                </div>
              </div>
            )}
            {history.length > 0 && (
              <div className="rr-group">
                <div className="rr-bucket"><Pill>WATCHED HISTORY</Pill></div>
                <div className="rr-rowlist">
                  {history.map(m => (
                    <MovieRow key={m.id} movie={m} onOpen={() => onOpenMovie(m.id)} onQuick={() => onQuickWatch(m)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )
      )}

      {tab === "upcoming" && (
        upcoming.length === 0 ? (
          <EmptyState icon={Clock} text="No upcoming releases." sub="Add a release date when tracking a movie to see it here." />
        ) : (
          <div className="rr-rowlist">
            {upcoming.map(m => (
              <div key={m.id} className="rr-listrow2">
                <button className="rr-listrow2-main" onClick={() => onOpenMovie(m.id)}>
                  <div className="rr-poster small movie"><Film size={16} /></div>
                  <div className="rr-listrow2-info">
                    <div className="rr-listrow2-title">{m.title}</div>
                    <div className="rr-listrow2-code">{fmtDate(m.releaseDate)}</div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function MovieRow({ movie, onOpen, onQuick }) {
  return (
    <div className="rr-listrow2">
      <button className="rr-listrow2-main" onClick={onOpen}>
        <div className="rr-poster small movie"><Film size={16} /></div>
        <div className="rr-listrow2-info">
          <div className="rr-listrow2-title">{movie.title}</div>
          <div className="rr-listrow2-code">{(movie.genres || []).slice(0, 3).join(", ")}</div>
        </div>
      </button>
      <button className={`rr-check ${movie.watchedAt ? "on" : ""}`} onClick={onQuick}><Check size={15} /></button>
    </div>
  );
}

function AddMovieForm({ onClose, onAdd }) {
  const [title, setTitle] = useState("");
  const [genres, setGenres] = useState("");
  const [runtime, setRuntime] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  return (
    <div className="rr-addform">
      <div className="rr-addform-head">Add a movie <X size={16} onClick={onClose} className="rr-clear" /></div>
      <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
      <input placeholder="Genres (comma separated)" value={genres} onChange={e => setGenres(e.target.value)} />
      <div className="rr-addform-row">
        <input placeholder="Runtime (min)" type="number" value={runtime} onChange={e => setRuntime(e.target.value)} />
        <input placeholder="Release date" type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} />
      </div>
      <button className="rr-btn primary" disabled={!title.trim()} onClick={() => onAdd({
        title: title.trim(), genres: genres.split(",").map(g => g.trim()).filter(Boolean),
        runtime: Number(runtime) || null, releaseDate: releaseDate || null
      })}>Add movie</button>
    </div>
  );
}

/* ============ EXPLORE ============ */
function ExploreHome({ data, onOpenShow, onAddShow }) {
  const [tab, setTab] = useState("discover");
  const [trending, setTrending] = useState(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    if (tab === "discover" && !trending) {
      (async () => {
        try {
          const page = await tvFetch(`/shows?page=${Math.floor(Math.random() * 5)}`);
          const ranked = page.filter(s => s.image && s.rating?.average).sort((a, b) => b.rating.average - a.rating.average);
          setTrending(ranked.slice(0, 18));
        } catch (e) { setTrending([]); }
      })();
    }
  }, [tab, trending]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    let cancelled = false;
    setLoadingSearch(true);
    const t = setTimeout(async () => {
      try {
        const res = await tvFetch(`/search/shows?q=${encodeURIComponent(q)}`);
        if (!cancelled) setResults(res.map(r => r.show));
      } catch (e) { if (!cancelled) setResults([]); }
      finally { if (!cancelled) setLoadingSearch(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  return (
    <div className="rr-view">
      <header className="rr-header"><div className="rr-title">Explore</div></header>
      <div className="rr-segment">
        <button className={tab === "discover" ? "active" : ""} onClick={() => setTab("discover")}>Discover</button>
        <button className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>Search</button>
      </div>

      {tab === "discover" && (
        !trending ? (
          <div className="rr-empty"><Loader2 className="spin" size={20} /></div>
        ) : (
          <>
            <div className="rr-section-label">Top rated for you to try</div>
            <div className="rr-discovergrid">
              {trending.map(show => (
                <DiscoverCard key={show.id} show={show} added={!!data.shows[show.id]}
                  onOpen={() => onOpenShow(show.id)} onAdd={() => onAddShow(show)} />
              ))}
            </div>
          </>
        )
      )}

      {tab === "search" && (
        <>
          <div className="rr-searchbar">
            <Search size={16} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a show…" />
            {loadingSearch && <Loader2 className="spin" size={16} />}
            {q && !loadingSearch && <X size={16} className="rr-clear" onClick={() => setQ("")} />}
          </div>
          {!q && <EmptyState icon={Search} text="Look up any show." sub="Powered by the TVmaze catalog." />}
          <div className="rr-searchresults">
            {results.map(show => {
              const added = !!data.shows[show.id];
              return (
                <div key={show.id} className="rr-searchrow">
                  <button className="rr-searchrow-main" onClick={() => onOpenShow(show.id)}>
                    <div className="rr-poster small">{show.image ? <img src={show.image.medium} alt={show.name} /> : <Tv size={16} />}</div>
                    <div className="rr-searchrow-info">
                      <div className="rr-searchrow-name">{show.name}</div>
                      <div className="rr-searchrow-meta">{show.premiered ? show.premiered.slice(0, 4) : "—"} · {(show.genres || []).slice(0, 2).join(", ") || show.status}</div>
                    </div>
                  </button>
                  <button className={`rr-iconbtn ${added ? "on" : ""}`} onClick={() => onAddShow(show)}>
                    {added ? <Check size={15} /> : <Plus size={15} />}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DiscoverCard({ show, added, onOpen, onAdd }) {
  return (
    <div className="rr-discovercard">
      <button className="rr-discovercard-img" onClick={onOpen}>
        {show.image ? <img src={show.image.medium} alt={show.name} /> : <Tv size={20} />}
        <button className={`rr-discoveradd ${added ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); onAdd(); }}>
          {added ? <Check size={13} /> : <Plus size={13} />}
        </button>
      </button>
      <div className="rr-discovercard-name">{show.name}</div>
      <div className="rr-discovercard-meta">{(show.genres || []).slice(0, 2).join(" · ") || show.status}</div>
    </div>
  );
}

/* ============ SHOW DETAIL ============ */
function ShowDetail({ showId, data, episodesCache, castCache, ensureEpisodes, ensureCast, onBack, onAddShow, onRemoveShow, onToggleEp, onSetSeasonWatched, onOpenEpisode }) {
  const [fullShow, setFullShow] = useState(null);
  const [tab, setTab] = useState("episodes");
  const [openSeason, setOpenSeason] = useState(null);
  const eps = episodesCache[showId];
  const cast = castCache[showId];
  const inList = !!data.shows[showId];

  useEffect(() => {
    (async () => {
      try { setFullShow(await tvFetch(`/shows/${showId}`)); } catch (e) {}
      await ensureEpisodes(showId);
      await ensureCast(showId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId]);

  const seasons = useMemo(() => {
    if (!eps) return {};
    const g = {};
    eps.forEach(e => { g[e.season] = g[e.season] || []; g[e.season].push(e); });
    return g;
  }, [eps]);

  useEffect(() => {
    if (eps && eps.length && openSeason === null) {
      const nums = Object.keys(seasons).map(Number).sort((a, b) => a - b);
      setOpenSeason(nums[nums.length - 1]);
    }
  }, [eps, seasons, openSeason]);

  const watchedCount = eps ? eps.filter(e => data.watchedLog[e.id]).length : 0;
  const pct = eps && eps.length ? Math.round((watchedCount / eps.length) * 100) : 0;

  const continueTracking = useMemo(() => {
    if (!eps) return [];
    const now = Date.now();
    return eps.filter(e => e.airstamp && new Date(e.airstamp).getTime() <= now && !data.watchedLog[e.id]).slice(0, 6);
  }, [eps, data.watchedLog]);

  return (
    <div className="rr-view">
      <header className="rr-header">
        <button className="rr-back" onClick={onBack}><ChevronLeft size={20} /></button>
        <div className="rr-title rr-title-ellipsis">{fullShow?.name || "Loading…"}</div>
      </header>

      {!fullShow ? <div className="rr-empty"><Loader2 className="spin" size={22} /></div> : (
        <>
          <div className="rr-banner">
            {fullShow.image ? <img src={fullShow.image.medium} alt={fullShow.name} /> : <Tv size={30} />}
            <div className="rr-banner-fade" />
            <div className="rr-banner-info">
              <div className="rr-banner-name">{fullShow.name}</div>
              <div className="rr-banner-sub">{Object.keys(seasons).length || "?"} seasons · {fullShow.status}{fullShow.network ? ` · ${fullShow.network.name}` : ""}</div>
            </div>
          </div>
          <div className="rr-bannerbar"><div className="rr-bannerbar-fill" style={{ width: `${pct}%` }} /></div>

          <div className="rr-detail-actions2">
            <button className={`rr-btn ${inList ? "primary" : "outline"}`} onClick={() => inList ? onRemoveShow(showId) : onAddShow(fullShow)}>
              {inList ? <><Check size={14} /> In watch list</> : <><Plus size={14} /> Add to watch list</>}
            </button>
            {inList && <button className="rr-iconbtn danger" onClick={() => onRemoveShow(showId)}><Trash2 size={14} /></button>}
          </div>

          <div className="rr-segment">
            <button className={tab === "about" ? "active" : ""} onClick={() => setTab("about")}>About</button>
            <button className={tab === "episodes" ? "active" : ""} onClick={() => setTab("episodes")}>Episodes</button>
          </div>

          {tab === "about" && (
            <>
              {fullShow.summary && <p className="rr-summary">{stripHtml(fullShow.summary)}</p>}
              <div className="rr-tags">{(fullShow.genres || []).map(g => <span key={g} className="rr-tag">{g}</span>)}</div>
              <div className="rr-section-label">Cast</div>
              <div className="rr-castrow">
                {!cast ? <Loader2 className="spin" size={16} /> : cast.slice(0, 12).map(c => (
                  <div key={c.person.id} className="rr-castitem">
                    <div className="rr-castimg">{c.person.image ? <img src={c.person.image.medium} alt={c.person.name} /> : <Tv size={14} />}</div>
                    <div className="rr-castname">{c.person.name}</div>
                    <div className="rr-castchar">{c.character?.name}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "episodes" && (
            <>
              {continueTracking.length > 0 && (
                <>
                  <div className="rr-section-label">Continue tracking</div>
                  <div className="rr-continuerow">
                    {continueTracking.map(ep => (
                      <button key={ep.id} className="rr-continueitem" onClick={() => onOpenEpisode(showId, ep.id)}>
                        <div className="rr-poster small">{fullShow.image ? <img src={fullShow.image.medium} alt="" /> : <Tv size={14} />}</div>
                        <div className="rr-continuecode">{epCode(ep.season, ep.number)}</div>
                        <div className="rr-continuetitle">{ep.name}</div>
                        <button className="rr-check" onClick={(e) => { e.stopPropagation(); onToggleEp(fullShow, ep); }}><Check size={13} /></button>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="rr-section-label">All episodes</div>
              {!eps ? <div className="rr-empty"><Loader2 className="spin" size={20} /></div> : (
                <div className="rr-seasons">
                  {Object.keys(seasons).map(Number).sort((a, b) => a - b).map(sNum => {
                    const seasonEps = seasons[sNum];
                    const wIn = seasonEps.filter(e => data.watchedLog[e.id]).length;
                    const all = wIn === seasonEps.length;
                    const open = openSeason === sNum;
                    return (
                      <div key={sNum} className="rr-season">
                        <button className="rr-season-head" onClick={() => setOpenSeason(open ? null : sNum)}>
                          <ChevronDown size={16} className={`rr-chev ${open ? "open" : ""}`} />
                          <span>Season {sNum}</span>
                          <span className="rr-season-count">{wIn}/{seasonEps.length}</span>
                          <span className="rr-season-toggle" onClick={(e) => { e.stopPropagation(); onSetSeasonWatched(fullShow, seasonEps, !all); }}>
                            {all ? "Unmark all" : "Mark all"}
                          </span>
                        </button>
                        {open && (
                          <div className="rr-eplist">
                            {seasonEps.map(ep => {
                              const w = data.watchedLog[ep.id];
                              return (
                                <button key={ep.id} className="rr-eprow" onClick={() => onOpenEpisode(showId, ep.id)}>
                                  <div className="rr-poster small">{fullShow.image ? <img src={fullShow.image.medium} alt="" /> : <Tv size={14} />}</div>
                                  <div className="rr-eprow-info">
                                    <div className="rr-eprow-code">{epCode(ep.season, ep.number)}</div>
                                    <div className="rr-eprow-title">{ep.name}</div>
                                  </div>
                                  <span className={`rr-dotcheck ${w ? "on" : ""}`}><Check size={12} /></span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ============ EPISODE DETAIL ============ */
function EpisodeDetail({ showId, episodeId, data, episodesCache, onBack, onSave }) {
  const eps = episodesCache[showId] || [];
  const ep = eps.find(e => String(e.id) === String(episodeId));
  const show = data.shows[showId];
  const existing = data.watchedLog[episodeId];
  const [rating, setRating] = useState(existing?.rating || 0);
  const [mood, setMood] = useState(existing?.mood || null);
  const [where, setWhere] = useState(existing?.whereWatched || null);

  if (!ep) return (
    <div className="rr-view">
      <header className="rr-header"><button className="rr-back" onClick={onBack}><ChevronLeft size={20} /></button></header>
      <div className="rr-empty"><Loader2 className="spin" size={20} /></div>
    </div>
  );

  const watched = !!data.watchedLog[ep.id];
  const showObj = show || { id: showId, name: "", genres: [] };

  const save = (patch) => {
    onSave(showObj, ep, { rating: patch.rating ?? rating, mood: patch.mood ?? mood, whereWatched: patch.whereWatched ?? where, watchedAt: existing?.watchedAt || Date.now() });
  };

  return (
    <div className="rr-view">
      <header className="rr-header">
        <button className="rr-back" onClick={onBack}><ChevronLeft size={20} /></button>
        <div className="rr-title rr-title-ellipsis">{epCode(ep.season, ep.number)}</div>
      </header>

      <div className="rr-epbanner">
        {ep.image ? <img src={ep.image.medium} alt={ep.name} /> : (show?.image ? <img src={show.image} alt="" /> : <Tv size={26} />)}
      </div>
      <div className="rr-epheadline">{ep.name}</div>
      <div className="rr-epmeta">
        <Clock size={12} /> {ep.airdate ? fmtDate(ep.airdate) : "TBA"}
        {watched && <> <Eye size={12} /> watched {fmtDate(existing.watchedAt)}</>}
      </div>

      <button className={`rr-bigcheck ${watched ? "on" : ""}`} onClick={() => onSave(showObj, ep)}>
        <Check size={16} /> {watched ? "Watched" : "Mark watched"}
      </button>

      <div className="rr-section-label">Where did you watch?</div>
      <div className="rr-wherechips">
        {SHOW_WHERE.map(w => (
          <button key={w} className={`rr-wherechip ${where === w ? "on" : ""}`}
            onClick={() => { setWhere(w); save({ whereWatched: w }); }}>
            {w === "TV" ? <Monitor size={14} /> : w === "Streaming" ? <Monitor size={14} /> : w === "Other" ? <MoreHorizontal size={14} /> : <Ban size={14} />}
            {w}
          </button>
        ))}
      </div>

      <div className="rr-section-label">Rate this episode</div>
      <div className="rr-stars">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} className="rr-starbtn" onClick={() => { setRating(n); save({ rating: n }); }}>
            <Star size={22} className={n <= rating ? "on" : ""} fill={n <= rating ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      {rating > 0 && <div className="rr-starlabel">{RATING_LABELS[rating - 1]}</div>}

      <div className="rr-section-label">How did you feel?</div>
      <div className="rr-moodgrid">
        {MOODS.map(m => (
          <button key={m.key} className={`rr-mooditem ${mood === m.key ? "on" : ""}`}
            onClick={() => { setMood(m.key); save({ mood: m.key }); }}>
            <span className="rr-moodemoji">{m.emoji}</span>{m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============ MOVIE DETAIL ============ */
function MovieDetail({ movie, onBack, onUpdate, onDelete }) {
  if (!movie) return null;
  const watched = !!movie.watchedAt;
  return (
    <div className="rr-view">
      <header className="rr-header">
        <button className="rr-back" onClick={onBack}><ChevronLeft size={20} /></button>
        <div className="rr-title rr-title-ellipsis">{movie.title}</div>
        <button className="rr-iconbtn danger" onClick={onDelete}><Trash2 size={14} /></button>
      </header>

      <div className="rr-epbanner movie"><Film size={28} /></div>
      <div className="rr-epheadline">{movie.title}</div>
      <div className="rr-tags">{(movie.genres || []).map(g => <span key={g} className="rr-tag">{g}</span>)}</div>
      <div className="rr-epmeta">
        {movie.releaseDate && <>{fmtDate(movie.releaseDate)} · </>}
        {movie.runtime && <>{movie.runtime}m</>}
      </div>

      <div className="rr-detail-actions2">
        <button className={`rr-btn ${watched ? "primary" : "outline"}`} onClick={() => onUpdate({ watchedAt: watched ? null : Date.now() })}>
          <Check size={14} /> {watched ? "Watched" : "Mark watched"}
        </button>
        <button className={`rr-iconbtn ${movie.favorite ? "on" : ""}`} onClick={() => onUpdate({ favorite: !movie.favorite })}>
          <Heart size={14} fill={movie.favorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="rr-section-label">Where did you watch?</div>
      <div className="rr-wherechips">
        {MOVIE_WHERE.map(w => (
          <button key={w} className={`rr-wherechip ${movie.whereWatched === w ? "on" : ""}`} onClick={() => onUpdate({ whereWatched: w })}>
            {w === "Theater" ? <Film size={14} /> : w === "Streaming" ? <Monitor size={14} /> : w === "Other" ? <MoreHorizontal size={14} /> : <Ban size={14} />}
            {w}
          </button>
        ))}
      </div>

      <div className="rr-section-label">Rate this movie</div>
      <div className="rr-stars">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} className="rr-starbtn" onClick={() => onUpdate({ rating: n, watchedAt: movie.watchedAt || Date.now() })}>
            <Star size={22} className={n <= (movie.rating || 0) ? "on" : ""} fill={n <= (movie.rating || 0) ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      {movie.rating > 0 && <div className="rr-starlabel">{RATING_LABELS[movie.rating - 1]}</div>}

      <div className="rr-section-label">How did you feel?</div>
      <div className="rr-moodgrid">
        {MOODS.map(m => (
          <button key={m.key} className={`rr-mooditem ${movie.mood === m.key ? "on" : ""}`} onClick={() => onUpdate({ mood: m.key })}>
            <span className="rr-moodemoji">{m.emoji}</span>{m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============ STATS ============ */
function StatsView({ data, episodesCache }) {
  const [tab, setTab] = useState("shows");
  const watchedEntries = Object.values(data.watchedLog);
  const movies = Object.values(data.movies);
  const watchedMovies = movies.filter(m => m.watchedAt);

  const showsStats = useMemo(() => {
    const totalMinutes = watchedEntries.reduce((s, e) => s + (e.runtime || 42), 0);
    const totalEpisodes = watchedEntries.length;

    const showsCompleted = Object.values(data.shows).filter(show => {
      const eps = episodesCache[show.id];
      return eps && eps.length && eps.every(e => data.watchedLog[e.id]);
    }).length;

    const genreCounts = {};
    watchedEntries.forEach(e => (e.genres || []).forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; }));
    const genreData = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

    const networkCounts = {};
    Object.values(data.shows).forEach(s => { if (s.network) networkCounts[s.network] = (networkCounts[s.network] || 0) + 1; });
    const topNetworks = Object.entries(networkCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const marathonMap = {};
    watchedEntries.forEach(e => {
      const day = new Date(e.watchedAt).toDateString();
      const key = `${e.showId}__${day}`;
      marathonMap[key] = marathonMap[key] || { showName: e.showName, count: 0 };
      marathonMap[key].count++;
    });
    const marathons = Object.values(marathonMap).sort((a, b) => b.count - a.count).slice(0, 5);

    const remainingEpisodes = Object.values(data.shows).reduce((sum, show) => {
      const eps = episodesCache[show.id] || [];
      const watched = eps.filter(e => data.watchedLog[e.id]).length;
      return sum + Math.max(eps.length - watched, 0);
    }, 0);

    const sixtyDaysAgo = Date.now() - 60 * 86400000;
    const recentCount = watchedEntries.filter(e => e.watchedAt >= sixtyDaysAgo).length;
    const catchUpRate = recentCount / (60 / 7);
    const avgRuntime = totalEpisodes ? totalMinutes / totalEpisodes : 42;
    const timeToWatchHours = Math.round((remainingEpisodes * avgRuntime) / 60);
    let catchUpDate = null;
    if (catchUpRate > 0.1) {
      const weeksNeeded = remainingEpisodes / catchUpRate;
      catchUpDate = new Date(Date.now() + weeksNeeded * 7 * 86400000);
    }

    const monthly = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const label = dd.toLocaleString(undefined, { month: "short" });
      const count = watchedEntries.filter(e => {
        const ed = new Date(e.watchedAt);
        return ed.getFullYear() === dd.getFullYear() && ed.getMonth() === dd.getMonth();
      }).length;
      monthly.push({ name: label, eps: count });
    }

    return { totalMinutes, totalEpisodes, showsCompleted, genreData, topNetworks, marathons, remainingEpisodes, catchUpRate, timeToWatchHours, catchUpDate, monthly };
  }, [data, episodesCache, watchedEntries]);

  const badges = useMemo(() => {
    const genreSet = new Set();
    watchedEntries.forEach(e => (e.genres || []).forEach(g => genreSet.add(g)));
    const maxMarathon = showsStats.marathons[0]?.count || 0;
    return [
      { id: "century", label: "Century Club", desc: "100 episodes watched", earned: showsStats.totalEpisodes >= 100, icon: Award },
      { id: "marathoner", label: "Marathoner", desc: "10+ episodes in one day", earned: maxMarathon >= 10, icon: Flame },
      { id: "completionist", label: "Completionist", desc: "Finish a full show", earned: showsStats.showsCompleted >= 1, icon: CheckCircle2 },
      { id: "explorer", label: "Genre Explorer", desc: "5+ genres watched", earned: genreSet.size >= 5, icon: Compass }
    ];
  }, [showsStats, watchedEntries]);

  const wt = formatWatchTime(showsStats.totalMinutes);

  return (
    <div className="rr-view">
      <header className="rr-header"><div className="rr-title">Stats</div></header>
      <div className="rr-segment">
        <button className={tab === "shows" ? "active" : ""} onClick={() => setTab("shows")}>Shows</button>
        <button className={tab === "movies" ? "active" : ""} onClick={() => setTab("movies")}>Movies</button>
      </div>

      {tab === "shows" && (
        showsStats.totalEpisodes === 0 ? (
          <EmptyState icon={BarChart3} text="No viewing history yet." sub="Mark episodes watched to see your stats fill in." />
        ) : (
          <>
            <StatBlock label="Time spent watching episodes">
              <div className="rr-bigstat">
                <span>{wt.months}<small>mo</small></span> <span>{wt.days}<small>d</small></span> <span>{wt.hours}<small>h</small></span>
              </div>
            </StatBlock>
            <StatBlock label="Episodes watched per month">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={showsStats.monthly}>
                  <XAxis dataKey="name" stroke="#8B8F98" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: "#1B1D22", border: "1px solid #2E323B", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#EDEAE4" }} />
                  <Bar dataKey="eps" fill="#FFB238" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </StatBlock>
            <StatBlock label="Total episodes watched"><div className="rr-bigstat"><span>{showsStats.totalEpisodes}</span></div></StatBlock>

            {showsStats.marathons.length > 0 && (
              <StatBlock label="Biggest marathons">
                <table className="rr-table">
                  <thead><tr><th>Show</th><th>Episodes</th></tr></thead>
                  <tbody>{showsStats.marathons.map((m, i) => <tr key={i}><td>{m.showName}</td><td>{m.count}</td></tr>)}</tbody>
                </table>
              </StatBlock>
            )}

            {showsStats.genreData.length > 0 && (
              <StatBlock label="Genres you watch">
                <div className="rr-chartbox-row">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={showsStats.genreData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={54} paddingAngle={2}>
                        {showsStats.genreData.map((g, i) => <Cell key={g.name} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="rr-legend">
                    {showsStats.genreData.map((g, i) => (
                      <div key={g.name} className="rr-legend-row">
                        <span className="rr-legend-dot" style={{ background: GENRE_COLORS[i % GENRE_COLORS.length] }} />
                        {g.name} <span className="rr-legend-count">{g.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </StatBlock>
            )}

            {showsStats.topNetworks.length > 0 && (
              <StatBlock label="Top networks">
                <table className="rr-table">
                  <thead><tr><th>Network</th><th>Shows</th></tr></thead>
                  <tbody>{showsStats.topNetworks.map(([n, c]) => <tr key={n}><td>{n}</td><td>{c}</td></tr>)}</tbody>
                </table>
              </StatBlock>
            )}

            <StatBlock label="Remaining episodes"><div className="rr-bigstat"><span>{showsStats.remainingEpisodes}</span></div></StatBlock>
            <StatBlock label="How fast are you catching up?"><div className="rr-bigstat small"><span>{showsStats.catchUpRate.toFixed(2)}</span></div><div className="rr-substat">episodes / week</div></StatBlock>
            <StatBlock label="Time to watch remaining"><div className="rr-bigstat small"><span>{showsStats.timeToWatchHours}</span></div><div className="rr-substat">hours</div></StatBlock>
            <StatBlock label="When will you catch up?">
              <div className="rr-bigstat small"><span>{showsStats.catchUpDate ? showsStats.catchUpDate.toISOString().slice(0, 10) : "—"}</span></div>
            </StatBlock>

            <StatBlock label="Badges">
              <div className="rr-badgegrid">
                {badges.map(b => (
                  <div key={b.id} className={`rr-badgeitem ${b.earned ? "earned" : ""}`}>
                    <b.icon size={20} />
                    <div className="rr-badgeitem-label">{b.label}</div>
                    <div className="rr-badgeitem-desc">{b.desc}</div>
                  </div>
                ))}
              </div>
            </StatBlock>
          </>
        )
      )}

      {tab === "movies" && (
        watchedMovies.length === 0 ? (
          <EmptyState icon={Film} text="No movie history yet." sub="Mark movies watched to see stats here." />
        ) : (
          <>
            <StatBlock label="Total movies watched"><div className="rr-bigstat"><span>{watchedMovies.length}</span></div></StatBlock>
            <StatBlock label="Time spent watching movies">
              {(() => { const mwt = formatWatchTime(watchedMovies.reduce((s, m) => s + (m.runtime || 120), 0));
                return <div className="rr-bigstat"><span>{mwt.months}<small>mo</small></span> <span>{mwt.days}<small>d</small></span> <span>{mwt.hours}<small>h</small></span></div>; })()}
            </StatBlock>
            <StatBlock label="Favorites"><div className="rr-bigstat"><span>{movies.filter(m => m.favorite).length}</span></div></StatBlock>
            <StatBlock label="Still to watch"><div className="rr-bigstat"><span>{movies.length - watchedMovies.length}</span></div></StatBlock>
          </>
        )
      )}
    </div>
  );
}
function StatBlock({ label, children }) {
  return <div className="rr-statblock"><div className="rr-statblock-label">{label}</div>{children}</div>;
}

/* ============ AI ============ */
function AIView({ data, onOpenExplore }) {
  const [mood, setMood] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recs, setRecs] = useState(null);

  const trackedNames = Object.values(data.shows).map(s => s.name);
  const genreCounts = {};
  Object.values(data.watchedLog).forEach(e => (e.genres || []).forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; }));
  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);

  const getRecs = async () => {
    setLoading(true); setError(null); setRecs(null);
    try {
      const prompt = `Based on this viewer's data, recommend exactly 5 TV shows they would likely enjoy.
Shows they're currently tracking: ${trackedNames.length ? trackedNames.join(", ") : "none yet"}.
Their most-watched genres: ${topGenres.length ? topGenres.join(", ") : "unknown"}.
Extra preference from the viewer right now: "${mood || "no specific mood, just general recommendations"}".
Do not recommend shows already in their tracked list.
Respond with ONLY a raw JSON array (no markdown fences, no preamble) of exactly 5 objects, each with keys: "title", "year", "genres" (array of up to 3 strings), "reason" (a specific one-to-two sentence reason tied to their taste).`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] })
      });
      const json = await response.json();
      const text = (json.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
      setRecs(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch (e) { setError("Couldn't get recommendations. Try again in a moment."); }
    finally { setLoading(false); }
  };

  return (
    <div className="rr-view">
      <header className="rr-header"><div className="rr-title">AI picks</div></header>
      <div className="rr-ai-intro">
        Recommendations based on {trackedNames.length ? `${trackedNames.length} tracked show${trackedNames.length > 1 ? "s" : ""}` : "your taste"}
        {topGenres.length ? ` and a leaning toward ${topGenres.slice(0, 2).join(" & ")}` : ""}.
      </div>
      <div className="rr-searchbar">
        <Sparkles size={16} />
        <input value={mood} onChange={e => setMood(e.target.value)} placeholder="Optional: in the mood for something…" />
      </div>
      <button className="rr-btn primary rr-ai-btn" onClick={getRecs} disabled={loading}>
        {loading ? <><Loader2 className="spin" size={15} /> Thinking…</> : <><Sparkles size={15} /> Get recommendations</>}
      </button>
      {error && <div className="rr-error">{error}</div>}
      {recs && (
        <div className="rr-reclist">
          {recs.map((r, i) => (
            <div key={i} className="rr-reccard">
              <div className="rr-reccard-head"><div className="rr-reccard-title">{r.title}</div><div className="rr-reccard-year">{r.year}</div></div>
              <div className="rr-tags">{(r.genres || []).map(g => <span key={g} className="rr-tag">{g}</span>)}</div>
              <div className="rr-reccard-reason">{r.reason}</div>
              <button className="rr-btn outline small" onClick={onOpenExplore}><Search size={12} /> Find it</button>
            </div>
          ))}
        </div>
      )}
      {!recs && !loading && !error && <EmptyState icon={Sparkles} text="Ask for picks anytime." sub="The more you track and watch, the sharper these get." />}
    </div>
  );
}

/* ============ STYLES ============ */
function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
      .rr-root { --bg:#121316; --surface:#1B1D22; --surface-2:#24272E; --border:#2E323B; --text:#EDEAE4; --text-muted:#8B8F98; --amber:#FFB238; --amber-dim:#7A5A20; --teal:#4FD8C4; --red:#FF5C5C;
        font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); min-height:100vh; display:flex; justify-content:center;
        background-image: radial-gradient(circle at 50% 0%, #1a1c21 0%, #121316 60%); }
      .rr-loading { align-items:center; justify-content:center; }
      .rr-root .spin { animation: rr-spin 0.9s linear infinite; color: var(--amber); }
      @keyframes rr-spin { to { transform: rotate(360deg); } }
      .rr-frame { width:100%; max-width:460px; min-height:100vh; background:var(--bg); border-left:1px solid var(--border); border-right:1px solid var(--border); display:flex; flex-direction:column; position:relative; }
      .rr-content { flex:1; overflow-y:auto; padding-bottom:84px; }
      .rr-view { padding:18px 16px 8px; }
      .rr-header { display:flex; align-items:center; gap:10px; margin-bottom:14px; min-height:30px; }
      .rr-logo { font-family:'Archivo Black',sans-serif; font-size:20px; }
      .rr-dot { color:var(--amber); }
      .rr-title { font-family:'Archivo Black',sans-serif; font-size:17px; flex:1; }
      .rr-title-ellipsis { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .rr-back { background:var(--surface); border:1px solid var(--border); color:var(--text); width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
      .rr-addbtn { background:var(--amber); color:#1B1000; width:30px; height:30px; border-radius:8px; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; margin-left:auto; }

      .rr-btn { border-radius:9px; border:1px solid transparent; padding:8px 14px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-family:inherit; }
      .rr-btn.primary { background:var(--amber); color:#1B1000; }
      .rr-btn.outline { background:transparent; color:var(--text); border-color:var(--border); }
      .rr-btn.small { padding:6px 10px; font-size:12px; }
      .rr-btn:disabled { opacity:0.5; cursor:default; }

      .rr-segment { display:flex; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:3px; margin-bottom:14px; }
      .rr-segment button { flex:1; background:transparent; border:none; color:var(--text-muted); font-size:12.5px; font-weight:600; padding:8px 4px; border-radius:7px; cursor:pointer; font-family:inherit; }
      .rr-segment button.active { background:var(--surface-2); color:var(--text); }

      .rr-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:40px 20px; color:var(--text-muted); text-align:center; }
      .rr-empty-text { font-size:14px; font-weight:600; color:var(--text); }
      .rr-empty-sub { font-size:12px; max-width:240px; }

      .rr-pill { font-size:10px; background:var(--surface-2); border:1px solid var(--border); color:var(--text-muted); padding:4px 9px; border-radius:20px; font-weight:700; letter-spacing:0.5px; }
      .rr-bucket { margin:14px 2px 8px; }
      .rr-group { margin-bottom:6px; }
      .rr-listtop { display:flex; justify-content:flex-end; margin-bottom:4px; }
      .rr-iconbtn { width:30px; height:30px; border-radius:8px; background:var(--surface-2); border:1px solid var(--border); color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; }
      .rr-iconbtn.on { background:var(--amber); border-color:var(--amber); color:#1B1000; }
      .rr-iconbtn.danger { color:var(--red); }

      .rr-rowlist { display:flex; flex-direction:column; gap:8px; }
      .rr-listrow2 { display:flex; align-items:center; gap:8px; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:9px; }
      .rr-listrow2-main { display:flex; gap:10px; align-items:center; flex:1; min-width:0; background:transparent; border:none; text-align:left; cursor:pointer; color:var(--text); font-family:inherit; }
      .rr-listrow2-info { min-width:0; flex:1; }
      .rr-listrow2-tag { font-size:11px; font-weight:700; color:var(--amber); display:flex; align-items:center; gap:2px; }
      .rr-tag-chev { color:var(--text-muted); }
      .rr-listrow2-code { font-family:'IBM Plex Mono',monospace; font-size:12.5px; font-weight:600; margin-top:2px; }
      .rr-plus { color:var(--text-muted); margin-left:4px; }
      .rr-listrow2-title { font-size:12px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:1px; }
      .rr-badge { font-size:9px; font-weight:700; letter-spacing:0.5px; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block; }
      .rr-badge.new { background:var(--amber); color:#1B1000; }
      .rr-badge.aired { background:var(--teal); color:#04211D; }
      .rr-badge.premiere { background:var(--red); color:#fff; }
      .rr-badge.latest { background:var(--surface-2); color:var(--text-muted); border:1px solid var(--border); }

      .rr-check { width:30px; height:30px; border-radius:50%; border:1.5px solid var(--border); background:transparent; color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
      .rr-check.on { background:var(--teal); border-color:var(--teal); color:#04211D; }
      .rr-check:disabled { opacity:0.3; cursor:default; }

      .rr-poster { width:44px; height:60px; border-radius:6px; overflow:hidden; background:var(--surface-2); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text-muted); }
      .rr-poster img { width:100%; height:100%; object-fit:cover; }
      .rr-poster.small { width:38px; height:52px; }
      .rr-poster.tall { width:100%; height:150px; }
      .rr-poster.movie { background:linear-gradient(160deg,var(--surface-2),#2a1e14); }
      .rr-postergrid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
      .rr-posteritem { background:transparent; border:none; cursor:pointer; padding:0; }

      .rr-searchbar { display:flex; align-items:center; gap:8px; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:10px 12px; margin-bottom:14px; color:var(--text-muted); }
      .rr-searchbar input { flex:1; background:transparent; border:none; outline:none; color:var(--text); font-size:14px; font-family:inherit; }
      .rr-clear { cursor:pointer; }
      .rr-searchresults { display:flex; flex-direction:column; gap:8px; }
      .rr-searchrow { display:flex; align-items:center; gap:8px; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:8px; }
      .rr-searchrow-main { display:flex; gap:10px; align-items:center; flex:1; min-width:0; background:transparent; border:none; text-align:left; cursor:pointer; color:var(--text); font-family:inherit; }
      .rr-searchrow-info { min-width:0; }
      .rr-searchrow-name { font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .rr-searchrow-meta { font-size:11px; color:var(--text-muted); margin-top:2px; }

      .rr-section-label { font-size:11px; letter-spacing:1px; color:var(--text-muted); font-weight:700; text-transform:uppercase; margin:16px 2px 8px; }
      .rr-discovergrid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
      .rr-discovercard { display:flex; flex-direction:column; gap:4px; }
      .rr-discovercard-img { position:relative; width:100%; height:120px; border-radius:8px; overflow:hidden; background:var(--surface-2); border:none; padding:0; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-muted); }
      .rr-discovercard-img img { width:100%; height:100%; object-fit:cover; }
      .rr-discoveradd { position:absolute; top:5px; right:5px; width:22px; height:22px; border-radius:6px; background:rgba(0,0,0,0.6); border:1px solid var(--amber); color:var(--amber); display:flex; align-items:center; justify-content:center; }
      .rr-discoveradd.on { background:var(--amber); color:#1B1000; }
      .rr-discovercard-name { font-size:11px; font-weight:600; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      .rr-discovercard-meta { font-size:9.5px; color:var(--text-muted); }

      .rr-banner { position:relative; height:170px; border-radius:12px; overflow:hidden; background:var(--surface-2); display:flex; align-items:center; justify-content:center; }
      .rr-banner img { width:100%; height:100%; object-fit:cover; }
      .rr-banner-fade { position:absolute; inset:0; background:linear-gradient(to bottom, transparent 40%, rgba(18,19,22,0.95) 100%); }
      .rr-banner-info { position:absolute; bottom:10px; left:12px; right:12px; }
      .rr-banner-name { font-family:'Archivo Black',sans-serif; font-size:16px; }
      .rr-banner-sub { font-size:11.5px; color:var(--text-muted); margin-top:2px; }
      .rr-bannerbar { height:4px; background:var(--surface-2); border-radius:3px; overflow:hidden; margin-top:8px; }
      .rr-bannerbar-fill { height:100%; background:var(--amber); }
      .rr-detail-actions2 { display:flex; gap:8px; margin:12px 0 4px; }
      .rr-summary { font-size:13px; line-height:1.55; color:var(--text-muted); margin:8px 0 4px; }
      .rr-tags { display:flex; flex-wrap:wrap; gap:5px; margin:6px 0; }
      .rr-tag { font-size:10.5px; background:var(--surface-2); border:1px solid var(--border); color:var(--text-muted); padding:3px 8px; border-radius:20px; }

      .rr-castrow { display:flex; gap:12px; overflow-x:auto; padding-bottom:6px; }
      .rr-castitem { flex-shrink:0; width:62px; text-align:center; }
      .rr-castimg { width:52px; height:52px; border-radius:50%; overflow:hidden; background:var(--surface-2); margin:0 auto 5px; display:flex; align-items:center; justify-content:center; color:var(--text-muted); }
      .rr-castimg img { width:100%; height:100%; object-fit:cover; }
      .rr-castname { font-size:10px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .rr-castchar { font-size:9px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

      .rr-continuerow { display:flex; gap:10px; overflow-x:auto; padding-bottom:6px; }
      .rr-continueitem { flex-shrink:0; width:110px; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:8px; display:flex; flex-direction:column; gap:5px; cursor:pointer; text-align:left; color:var(--text); font-family:inherit; }
      .rr-continuecode { font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:var(--amber); font-weight:600; }
      .rr-continuetitle { font-size:10.5px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }

      .rr-seasons { display:flex; flex-direction:column; gap:8px; }
      .rr-season { background:var(--surface); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
      .rr-season-head { width:100%; display:flex; align-items:center; gap:8px; background:transparent; border:none; color:var(--text); padding:11px 12px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
      .rr-chev { transition:transform 0.15s ease; color:var(--text-muted); }
      .rr-chev.open { transform:rotate(180deg); }
      .rr-season-count { font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--text-muted); margin-left:auto; }
      .rr-season-toggle { font-size:11px; color:var(--amber); font-weight:600; padding-left:4px; }
      .rr-eplist { display:flex; flex-direction:column; padding:0 8px 8px; gap:4px; }
      .rr-eprow { display:flex; align-items:center; gap:8px; background:transparent; border:none; padding:6px; border-radius:8px; cursor:pointer; text-align:left; color:var(--text); font-family:inherit; }
      .rr-eprow:hover { background:var(--surface-2); }
      .rr-eprow-info { flex:1; min-width:0; }
      .rr-eprow-code { font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:var(--amber); font-weight:600; }
      .rr-eprow-title { font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .rr-dotcheck { width:20px; height:20px; border-radius:50%; border:1.5px solid var(--border); display:flex; align-items:center; justify-content:center; color:transparent; flex-shrink:0; }
      .rr-dotcheck.on { background:var(--teal); border-color:var(--teal); color:#04211D; }

      .rr-epbanner { height:150px; border-radius:12px; overflow:hidden; background:var(--surface-2); display:flex; align-items:center; justify-content:center; color:var(--text-muted); margin-bottom:10px; }
      .rr-epbanner img { width:100%; height:100%; object-fit:cover; }
      .rr-epbanner.movie { background:linear-gradient(160deg,var(--surface-2),#2a1e14); }
      .rr-epheadline { font-family:'Archivo Black',sans-serif; font-size:15px; }
      .rr-epmeta { font-size:11.5px; color:var(--text-muted); display:flex; align-items:center; gap:6px; margin:4px 0 12px; flex-wrap:wrap; }
      .rr-bigcheck { width:100%; justify-content:center; display:flex; align-items:center; gap:8px; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:11px; border-radius:10px; font-weight:600; font-size:13px; cursor:pointer; font-family:inherit; margin-bottom:6px; }
      .rr-bigcheck.on { background:var(--teal); border-color:var(--teal); color:#04211D; }

      .rr-wherechips { display:flex; gap:8px; flex-wrap:wrap; }
      .rr-wherechip { display:flex; align-items:center; gap:6px; background:var(--surface); border:1px solid var(--border); color:var(--text-muted); padding:8px 12px; border-radius:9px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; }
      .rr-wherechip.on { background:var(--amber); border-color:var(--amber); color:#1B1000; }

      .rr-stars { display:flex; gap:8px; }
      .rr-starbtn { background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:2px; }
      .rr-starbtn .on { color:var(--amber); }
      .rr-starlabel { font-size:11.5px; color:var(--amber); font-weight:700; margin-top:4px; }

      .rr-moodgrid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
      .rr-mooditem { display:flex; flex-direction:column; align-items:center; gap:4px; background:var(--surface); border:1px solid var(--border); color:var(--text-muted); padding:10px 4px; border-radius:10px; font-size:10.5px; font-weight:600; cursor:pointer; font-family:inherit; }
      .rr-mooditem.on { border-color:var(--amber); color:var(--amber); background:rgba(255,178,56,0.08); }
      .rr-moodemoji { font-size:18px; }

      .rr-addform { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:14px; display:flex; flex-direction:column; gap:8px; }
      .rr-addform-head { display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:700; margin-bottom:4px; }
      .rr-addform input { background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:9px 10px; color:var(--text); font-size:13px; font-family:inherit; outline:none; }
      .rr-addform-row { display:flex; gap:8px; }
      .rr-addform-row input { flex:1; }

      .rr-statblock { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:10px; }
      .rr-statblock-label { font-size:11px; letter-spacing:0.5px; color:var(--text-muted); font-weight:700; text-transform:uppercase; margin-bottom:8px; }
      .rr-bigstat { font-family:'IBM Plex Mono',monospace; font-size:26px; font-weight:700; display:flex; gap:8px; align-items:baseline; }
      .rr-bigstat.small { font-size:20px; }
      .rr-bigstat small { font-size:12px; color:var(--text-muted); margin-left:2px; }
      .rr-substat { font-size:11px; color:var(--text-muted); margin-top:2px; }
      .rr-table { width:100%; font-size:12px; border-collapse:collapse; }
      .rr-table th { text-align:left; color:var(--text-muted); font-weight:600; font-size:10.5px; text-transform:uppercase; padding-bottom:6px; }
      .rr-table td { padding:5px 0; border-top:1px solid var(--border); }
      .rr-table td:last-child, .rr-table th:last-child { text-align:right; }
      .rr-chartbox-row { display:flex; align-items:center; gap:10px; }
      .rr-legend { display:flex; flex-direction:column; gap:6px; font-size:12px; flex:1; }
      .rr-legend-row { display:flex; align-items:center; gap:7px; }
      .rr-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
      .rr-legend-count { color:var(--text-muted); margin-left:auto; font-family:'IBM Plex Mono',monospace; }
      .rr-badgegrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .rr-badgeitem { background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:10px; color:var(--text-muted); opacity:0.5; }
      .rr-badgeitem.earned { opacity:1; color:var(--amber); border-color:var(--amber-dim); }
      .rr-badgeitem-label { font-size:11.5px; font-weight:700; margin-top:6px; color:var(--text); }
      .rr-badgeitem-desc { font-size:10px; color:var(--text-muted); margin-top:2px; }

      .rr-ai-intro { font-size:12.5px; color:var(--text-muted); margin-bottom:14px; line-height:1.5; }
      .rr-ai-btn { width:100%; justify-content:center; margin-bottom:8px; }
      .rr-error { color:var(--red); font-size:12.5px; margin-bottom:10px; }
      .rr-reclist { display:flex; flex-direction:column; gap:10px; margin-top:8px; }
      .rr-reccard { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:13px; }
      .rr-reccard-head { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
      .rr-reccard-title { font-size:14px; font-weight:700; }
      .rr-reccard-year { font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--text-muted); }
      .rr-reccard-reason { font-size:12.5px; color:var(--text-muted); line-height:1.5; margin:8px 0 10px; }

      .rr-nav { position:sticky; bottom:0; display:flex; background:var(--surface); border-top:1px solid var(--border); padding:8px 4px calc(8px + env(safe-area-inset-bottom,0px)); }
      .rr-navbtn { flex:1; background:transparent; border:none; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:3px; font-size:9.5px; padding:5px 0; cursor:pointer; font-family:inherit; }
      .rr-navbtn.active { color:var(--amber); }
      @media (max-width:480px) { .rr-frame { border-left:none; border-right:none; } }
    `}</style>
  );
}
