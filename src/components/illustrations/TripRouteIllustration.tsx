export function TripRouteIllustration() {
  return (
    <svg viewBox="0 0 440 440" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden="true">
      <circle cx="220" cy="230" r="200" fill="#E0E7FF" />
      <circle cx="260" cy="180" r="150" fill="#E0F2FE" opacity="0.8" />
      <path
        d="M90 320 C 150 260, 180 180, 230 150 C 270 128, 310 150, 350 110"
        stroke="#4F46E5"
        strokeWidth="3"
        strokeDasharray="2 12"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="90" cy="320" r="9" fill="#4F46E5" stroke="white" strokeWidth="3" />
      <circle cx="230" cy="150" r="7" fill="#0EA5E9" stroke="white" strokeWidth="3" />
      <circle cx="350" cy="110" r="9" fill="#4F46E5" stroke="white" strokeWidth="3" />
      <g transform="translate(258, 128) rotate(-35)">
        <path d="M0 6 L26 0 L20 6 L26 12 Z" fill="#4F46E5" />
      </g>
    </svg>
  );
}
