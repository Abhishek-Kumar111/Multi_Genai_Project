import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

const STEPS = [
  { id: 1, key: "search", label: "Search Agent",  icon: "⚡", desc: "Finding recent & reliable information" },
  { id: 2, key: "reader", label: "Reader Agent",  icon: "📖", desc: "Scraping top resources for deeper content" },
  { id: 3, key: "writer", label: "Writer Chain",  icon: "✍️", desc: "Drafting the research report" },
  { id: 4, key: "critic", label: "Critic Chain",  icon: "🔍", desc: "Reviewing and refining the report" },
];

const STATUS = { idle: "idle", running: "running", done: "done", error: "error" };

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Parse the search_results string and extract URLs.
 * Handles common formats:
 *   - bare URLs on their own line
 *   - Markdown links  [title](url)
 *   - numbered / bulleted lists that contain a URL
 */
function extractLinks(raw = "") {
  const links = [];
  const seen = new Set();

  // Match markdown links first: [label](url)
  const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let m;
  while ((m = mdRe.exec(raw)) !== null) {
    const [, label, url] = m;
    if (!seen.has(url)) { seen.add(url); links.push({ label, url }); }
  }

  // Then bare URLs not already captured
  const urlRe = /https?:\/\/[^\s\)>\]"]+/g;
  while ((m = urlRe.exec(raw)) !== null) {
    const url = m[0].replace(/[.,;:!?]+$/, ""); // strip trailing punctuation
    if (!seen.has(url)) { seen.add(url); links.push({ label: url, url }); }
  }

  return links;
}

// ─── component ──────────────────────────────────────────────────────────────

export default function App() {
  const [topic, setTopic]           = useState("");
  const [submittedTopic, setSubmittedTopic] = useState(""); // persists after run
  const [pipeline, setPipeline]     = useState(null);
  const [stepStatus, setStepStatus] = useState({});
  const [currentStep, setCurrentStep] = useState(null);
  const [running, setRunning]       = useState(false);
  const [error, setError]           = useState("");
  const [activeTab, setActiveTab]   = useState("report");

  // History: array of { topic, pipeline }
  const [history, setHistory]       = useState([]);

  const resultRef = useRef(null);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const runPipeline = async () => {
    if (!topic.trim() || running) return;

    const currentTopic = topic.trim();
    setRunning(true);
    setError("");
    setPipeline(null);
    setStepStatus({});
    setCurrentStep(null);
    setSubmittedTopic(currentTopic); // keep query visible

    try {
      const initialStatus = {};
      STEPS.forEach((s) => (initialStatus[s.key] = STATUS.idle));
      setStepStatus(initialStatus);

      setCurrentStep("search");
      setStepStatus((prev) => ({ ...prev, search: STATUS.running }));

      const res = await fetch("http://localhost:5000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: currentTopic }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Pipeline failed");
      }

      // Animate steps sequentially while we wait for the already-resolved response
      for (let i = 0; i < STEPS.length; i++) {
        setCurrentStep(STEPS[i].key);
        setStepStatus((prev) => ({ ...prev, [STEPS[i].key]: STATUS.running }));
        await sleep(600);
        setStepStatus((prev) => ({ ...prev, [STEPS[i].key]: STATUS.done }));
        if (i < STEPS.length - 1) await sleep(300);
      }

      const data = await res.json();
      setPipeline(data);
      setCurrentStep(null);
      setActiveTab("report");

      // Prepend to history so newest is on top
      setHistory((prev) => [{ topic: currentTopic, pipeline: data }, ...prev]);

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(e.message);
      if (currentStep) {
        setStepStatus((prev) => ({ ...prev, [currentStep]: STATUS.error }));
      }
    } finally {
      setRunning(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !running) runPipeline();
  };

  // ── link renderer: opens in new tab ──────────────────────────────────────
  const LinkRenderer = ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
      {children}
    </a>
  );

  // ── render a tab's content ────────────────────────────────────────────────
  const renderTabContent = (data, tab) => {
    if (tab === "search_results") {
      const links = extractLinks(data?.search_results || "");
      return (
        <div className="link-list">
          {links.length === 0 ? (
            <p className="no-links">No links found in search results.</p>
          ) : (
            links.map(({ label, url }, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="ref-link"
              >
                <span className="ref-index">{i + 1}</span>
                <span className="ref-label">{label !== url ? label : new URL(url).hostname}</span>
                <span className="ref-url">{url}</span>
                <span className="ref-arrow">↗</span>
              </a>
            ))
          )}
        </div>
      );
    }

    return (
      <div className="result-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{ a: LinkRenderer }}
        >
          {data?.[tab] || "*No data available.*"}
        </ReactMarkdown>
      </div>
    );
  };

  // ── main render ───────────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="bg-grid" />
      <div className="bg-glow" />

      <header className="header">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">GenAI Research</span>
          <span className="logo-tag">Pipeline</span>
        </div>
        <p className="header-sub">Multi-agent research · Search → Read → Write → Critique</p>
      </header>

      <main className="main">
        {/* ── Input ── */}
        <section className="input-section">
          <label className="input-label">Research Topic</label>
          <div className="input-row">
            <input
              className="topic-input"
              type="text"
              placeholder="e.g. Latest advancements in quantum computing"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKey}
              disabled={running}
            />
            <button
              className={`run-btn ${running ? "running" : ""}`}
              onClick={runPipeline}
              disabled={running || !topic.trim()}
            >
              {running ? <span className="spinner" /> : "Run Pipeline"}
            </button>
          </div>

          {/* Persistent current query badge */}
          {submittedTopic && (
            <p className="current-query">
              <span className="current-query-label">Current query:</span>
              <span className="current-query-value">"{submittedTopic}"</span>
            </p>
          )}

          {error && <p className="error-msg">⚠ {error}</p>}
        </section>

        {/* ── Pipeline Steps ── */}
        <section className="steps-section">
          {STEPS.map((step, idx) => {
            const status = stepStatus[step.key] || STATUS.idle;
            return (
              <div key={step.id} className={`step-card step-${status}`}>
                <div className="step-connector" style={{ opacity: idx === 0 ? 0 : 1 }} />
                <div className="step-icon-wrap">
                  <span className="step-icon">{step.icon}</span>
                  {status === STATUS.running && <span className="pulse-ring" />}
                  {status === STATUS.done    && <span className="check-badge">✓</span>}
                </div>
                <div className="step-info">
                  <span className="step-num">Step {step.id}</span>
                  <span className="step-label">{step.label}</span>
                  <span className="step-desc">{step.desc}</span>
                </div>
                <div className="step-status-dot" data-status={status} />
              </div>
            );
          })}
        </section>

        {/* ── Current Results ── */}
        {pipeline && (
          <section className="results-section" ref={resultRef}>
            <div className="results-header">
              <h2 className="results-title">
                Research Complete
                <span className="results-topic-badge">"{submittedTopic}"</span>
              </h2>
              <div className="tab-bar">
                {[
                  { key: "report",         label: "📄 Report" },
                  { key: "feedback",       label: "🔍 Critic Feedback" },
                  { key: "search_results", label: "⚡ Search Results" },
                  { key: "scraped_content",label: "📖 Scraped Content" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="result-body">
              {renderTabContent(pipeline, activeTab)}
            </div>
          </section>
        )}

        {/* ── Search History ── */}
        {history.length > 1 && (
          <section className="history-section">
            <h3 className="history-title">Previous Searches</h3>
            {history.slice(1).map((entry, i) => (
              <HistoryEntry key={i} entry={entry} renderTabContent={renderTabContent} />
            ))}
          </section>
        )}
      </main>

      <footer className="footer">
        <span>GenAI Research Pipeline · Built with LangChain + React</span>
      </footer>
    </div>
  );
}

// ── Collapsible history entry ─────────────────────────────────────────────────
function HistoryEntry({ entry, renderTabContent }) {
  const [open, setOpen]         = useState(false);
  const [activeTab, setActiveTab] = useState("report");

  return (
    <div className={`history-card ${open ? "open" : ""}`}>
      <button className="history-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="history-chevron">{open ? "▾" : "▸"}</span>
        <span className="history-query">"{entry.topic}"</span>
      </button>
      {open && (
        <div className="history-body">
          <div className="tab-bar tab-bar--sm">
            {[
              { key: "report",          label: "📄 Report" },
              { key: "feedback",        label: "🔍 Feedback" },
              { key: "search_results",  label: "⚡ Search Results" },
              { key: "scraped_content", label: "📖 Scraped" },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="result-body">
            {renderTabContent(entry.pipeline, activeTab)}
          </div>
        </div>
      )}
    </div>
  );
}