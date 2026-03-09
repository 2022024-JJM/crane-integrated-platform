const TEXT = {
  titleLead: '크레인 통합',
  titleEmphasis: '모니터링',
  description:
    '모니터링할 지역을 선택하면 해당 지역의 3D 크레인 현황 화면으로 이동합니다.',
} as const;

function HeroCraneIllustration() {
  return (
    <svg
      className="w-[min(100%,320px)] shrink-0 opacity-[0.58] animate-[main-page-float_6s_ease-in-out_infinite]"
      width="220"
      height="160"
      viewBox="0 0 220 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="90" y="20" width="12" height="130" fill="#2a2c32" rx="2" />
      <rect
        x="90"
        y="20"
        width="12"
        height="130"
        fill="url(#towerGrad)"
        rx="2"
      />
      <rect x="60" y="20" width="130" height="5" fill="#f5a623" rx="2" />
      <rect
        x="40"
        y="20"
        width="52"
        height="4"
        fill="#c77a1f"
        rx="2"
        opacity="0.7"
      />
      <polygon points="96,8 104,8 100,20" fill="#f5a623" />
      <line
        x1="170"
        y1="25"
        x2="170"
        y2="100"
        stroke="#8a96a3"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <rect x="163" y="100" width="14" height="10" rx="2" fill="#4a525a" />
      <rect x="167" y="110" width="6" height="6" rx="1" fill="#5a626a" />
      <rect x="162" y="18" width="16" height="6" rx="2" fill="#e8922a" />
      <rect x="85" y="115" width="22" height="18" rx="2" fill="#23262b" />
      <rect
        x="87"
        y="117"
        width="8"
        height="6"
        rx="1"
        fill="#00a8ff"
        opacity="0.5"
      />
      <rect x="75" y="133" width="42" height="16" rx="3" fill="#1c1e23" />
      <rect x="72" y="148" width="48" height="8" rx="2" fill="#2a2c32" />
      <rect x="55" y="154" width="82" height="4" rx="1" fill="#3a3d45" />
      <circle cx="68" cy="156" r="4" fill="#2a2c32" />
      <circle cx="68" cy="156" r="2" fill="#4a525a" />
      <circle cx="124" cy="156" r="4" fill="#2a2c32" />
      <circle cx="124" cy="156" r="2" fill="#4a525a" />
      <line
        x1="100"
        y1="22"
        x2="60"
        y2="22"
        stroke="#ffcc66"
        strokeWidth="0.8"
        opacity="0.4"
      />
      <defs>
        <linearGradient id="towerGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f5a623" stopOpacity="0.08" />
          <stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function MainHero() {
  return (
    <section className="flex items-end justify-between gap-8 px-[clamp(20px,4vw,40px)] py-[clamp(44px,7vw,64px)] pb-[36px] animate-[main-page-fade-up_0.5s_ease_both] max-[960px]:flex-col max-[960px]:items-start">
      <div className="max-w-[560px]">
        <div className="inline-flex items-center gap-2.5 mb-[18px] text-[11px] text-[var(--main-page-steel)] uppercase tracking-[0.14em] before:content-[''] before:w-[30px] before:h-px before:bg-[linear-gradient(90deg,var(--main-page-accent),transparent)]">
          Region Control Desk
        </div>
        <h1 className="mt-0 text-[#fff] text-[clamp(3rem,3vw,5.2rem)] leading-[0.92] tracking-[0.06em] font-['Bebas_Neue',sans-serif]">
          {TEXT.titleLead}
        </h1>
        <h1 className="mt-2 text-[#f5a623] text-[clamp(3rem,3vw,5.2rem)] leading-[0.92] tracking-[0.06em] font-['Bebas_Neue',sans-serif]">
          {TEXT.titleEmphasis}
        </h1>
        <p className="max-w-[470px] mt-4 text-[14px] leading-[1.75] font-light text-[var(--main-page-steel)]">
          {TEXT.description}
        </p>
      </div>
      <HeroCraneIllustration />
    </section>
  );
}
