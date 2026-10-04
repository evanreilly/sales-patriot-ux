const paths = {
  checked: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" />
      <path d="m7 12 3.5 3.5L17 9" stroke="white" strokeWidth="2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  caution: (
    <>
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17.5" r=".75" fill="currentColor" stroke="none" />
    </>
  ),
  file: <path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" />,
  flag: (
    <>
      <path d="M6 21V3" />
      <path className="flag-pennant" d="M7 4v10l11-5Z" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
} as const;
export function Icon({
  name,
  size = 16,
}: {
  name: keyof typeof paths;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
