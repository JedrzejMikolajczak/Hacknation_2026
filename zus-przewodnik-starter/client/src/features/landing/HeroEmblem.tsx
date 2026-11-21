/** Dekoracyjna, animowana ilustracja w nagłówku – serce w pulsujących kręgach. */
export function HeroEmblem() {
  return (
    <div className="landing__emblem-wrap" aria-hidden="true">
      <span className="landing__orbit landing__orbit--a" />
      <span className="landing__orbit landing__orbit--b" />
      <svg
        className="landing__emblem"
        viewBox="0 0 120 120"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <circle className="landing__ring landing__ring--outer" cx="60" cy="60" r="56" />
        <circle className="landing__ring landing__ring--inner" cx="60" cy="60" r="44" />
        <g className="landing__heart">
          <path
            pathLength={1}
            d="M60 84 C30 64 34 40 50 40 C56 40 60 44 60 49 C60 44 64 40 70 40 C86 40 90 64 60 84Z"
          />
        </g>
      </svg>
    </div>
  );
}
