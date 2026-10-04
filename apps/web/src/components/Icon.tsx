type Name =
  | 'type'
  | 'fonts'
  | 'settings'
  | 'copy'
  | 'download'
  | 'arrow'
  | 'check'
  | 'book'
  | 'lock'
  | 'wifi'
  | 'close';
const paths: Record<Name, string> = {
  type: 'M4 5h16M12 5v15M8 20h8',
  fonts: 'm4 20 7-16h2l7 16M7 14h10',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  book: 'M12 5v16M12 5C9 3 5 3 2 5v15c3-2 7-2 10 1 3-3 7-3 10-1V5c-3-2-7-2-10 0',
  lock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4',
  wifi: 'M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0M12 20h.01',
  close: 'm6 6 12 12M6 18 18 6',
};
export function Icon({ name, size = 20 }: { name: Name; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
