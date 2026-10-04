import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

export type FontChoice = {
  id: string;
  name: string;
  detail: string;
  disabled?: boolean;
};

export function FontSearchPicker({
  value,
  choices,
  searchLabel,
  onChoose,
}: {
  value: string;
  choices: FontChoice[];
  searchLabel: string;
  onChoose(id: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const id = useId();
  const search = useRef<HTMLInputElement>(null);
  const selected = choices.find((choice) => choice.id === value);
  const visible = choices.filter((choice) =>
    `${choice.name} ${choice.detail}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );

  useEffect(() => {
    if (open) search.current?.focus();
    else setQuery('');
  }, [open]);

  return (
    <div className="font-search-picker">
      <button
        type="button"
        className="button secondary font-search-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selected?.name ?? 'Choose a font'}</span>
        <Icon name="search" size={16} />
      </button>
      {open ? (
        <div
          className="font-search-popover"
          id={id}
          role="dialog"
          aria-label={searchLabel}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          <label className="sr-only" htmlFor={`${id}-query`}>
            {searchLabel}
          </label>
          <input
            ref={search}
            id={`${id}-query`}
            type="search"
            value={query}
            placeholder="Search fonts"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="font-search-options" role="listbox" aria-label={searchLabel}>
            {visible.map((choice) => (
              <button
                type="button"
                role="option"
                aria-selected={choice.id === value}
                disabled={choice.disabled}
                key={choice.id}
                onClick={() => {
                  onChoose(choice.id);
                  setOpen(false);
                }}
              >
                <span>{choice.name}</span>
                <small>{choice.detail}</small>
              </button>
            ))}
            {!visible.length ? <p className="muted small">No fonts match.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
