import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Github, WandSparkles, FileCode2, CheckCircle2 } from 'lucide-react';
import './styles.css';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [url, setUrl] = useState('https://example.com');
  const [projectName, setProjectName] = useState('demo-eds-site');
  const [prompt, setPrompt] = useState('Migrate this page to AEM Edge Delivery Services with Universal Editor support.');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function startMigration() {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/migrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, projectName, prompt })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Migration failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">AEM + EDS + Universal Editor</p>
          <h1>AI Migration Accelerator</h1>
          <p className="subtitle">Generate a local EDS-style project from any website URL using a Node.js orchestration backend and React workspace.</p>
        </div>
        <div className="badge"><WandSparkles size={18} /> Copilot/Gemini Ready</div>
      </section>

      <section className="grid">
        <div className="card form-card">
          <h2>Migration Input</h2>
          <label>Source URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} />

          <label>Project Name</label>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />

          <label>Prompt</label>
          <textarea rows="5" value={prompt} onChange={(e) => setPrompt(e.target.value)} />

          <button onClick={startMigration} disabled={loading}>
            {loading ? 'Migrating...' : 'Start Migration'}
          </button>

          {error && <p className="error">{error}</p>}
        </div>

        <div className="card result-card">
          <h2>Generated Output</h2>
          {!result && <p className="muted">Run a migration to see generated files, detected blocks, and output directory.</p>}

          {result && (
            <>
              <div className="status"><CheckCircle2 size={18} /> Job completed: {result.jobId}</div>
              <p><strong>Output:</strong> {result.outputDir}</p>

              <h3>Detected Blocks</h3>
              <div className="blocks">
                {result.migrationPlan.blocks.map((block) => (
                  <div className="block-pill" key={`${block.name}-${block.order}`}>
                    {block.name} · {Math.round(block.confidence * 100)}%
                    {block.requiresReview ? ' · review' : ''}
                  </div>
                ))}
              </div>

              <h3><FileCode2 size={16} /> Files</h3>
              <pre>{result.files.join('\n')}</pre>
            </>
          )}
        </div>
      </section>

      <section className="card github-card">
        <h2><Github size={20} /> GitHub PR Integration Stub</h2>
        <p>This starter generates files locally. Extend <code>apps/api/src/services/githubService.js</code> using Octokit to create branches, commits, and PRs.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
