import { useState } from 'react';
import guide from '../../../../data/mozhi/guide.v1.json';
import { Icon } from './Icon';
export function Guide({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const matches = guide.filter((row) =>
    `${row.keys} ${row.output} ${row.label} ${row.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="guide card" aria-label="Mozhi typing guide">
      <div className="section-heading">
        <div>
          <h2>Mozhi typing guide</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close typing guide">
          <Icon name="close" />
        </button>
      </div>
      <p className="muted">
        Case matters: <code>tha</code> gives ത, while <code>Ta</code> gives ട. Keep English words
        with a backslash, or a passage inside braces.
      </p>
      <label className="search-label" htmlFor="guide-search">
        Find a letter, spelling or example
      </label>
      <input
        id="guide-search"
        className="search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Try chillu, zha, or vowels…"
      />
      <div className="guide-results" aria-live="polite">
        {matches.length ? (
          matches.map((row) => (
            <div className="guide-row" key={row.keys}>
              <div>
                <code>{row.keys}</code>
                <span>{row.label}</span>
              </div>
              <span className="malayalam" lang="ml">
                {row.output}
              </span>
            </div>
          ))
        ) : (
          <p>No matches. Try a letter or a category such as “vowels”.</p>
        )}
      </div>
      <a
        className="text-link"
        href="https://sites.google.com/site/cibu/mozhi2"
        target="_blank"
        rel="noreferrer"
      >
        Read the Mozhi 2 specification ↗
      </a>
    </section>
  );
}
