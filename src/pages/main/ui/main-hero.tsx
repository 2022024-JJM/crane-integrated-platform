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
      <rect
        x="90"
        y="20"
        width="12"
        height="130"
        fill="var(--main-page-border)"
        rx="2"
      />
      <rect
        x="90"
        y="20"
        width="12"
        height="130"
        fill="url(#towerGrad)"
        rx="2"
      />
      <rect
        x="60"
        y="20"
        width="130"
        height="5"
        fill="var(--main-page-accent)"
        rx="2"
      />
      <rect
        x="40"
        y="20"
        width="52"
        height="4"
        fill="var(--main-page-accent-strong)"
        rx="2"
        opacity="0.7"
      />
      <polygon points="96,8 104,8 100,20" fill="var(--main-page-accent)" />
      <line
        x1="170"
        y1="25"
        x2="170"
        y2="100"
        stroke="var(--main-page-illustration-line)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <rect
        x="163"
        y="100"
        width="14"
        height="10"
        rx="2"
        fill="var(--main-page-illustration-body)"
      />
      <rect
        x="167"
        y="110"
        width="6"
        height="6"
        rx="1"
        fill="var(--main-page-illustration-body-soft)"
      />
      <rect
        x="162"
        y="18"
        width="16"
        height="6"
        rx="2"
        fill="var(--main-page-accent)"
      />
      <rect
        x="85"
        y="115"
        width="22"
        height="18"
        rx="2"
        fill="var(--main-page-illustration-panel)"
      />
      <rect
        x="87"
        y="117"
        width="8"
        height="6"
        rx="1"
        fill="var(--main-page-illustration-window)"
        opacity="0.5"
      />
      <rect
        x="75"
        y="133"
        width="42"
        height="16"
        rx="3"
        fill="var(--main-page-card)"
      />
      <rect
        x="72"
        y="148"
        width="48"
        height="8"
        rx="2"
        fill="var(--main-page-border)"
      />
      <rect
        x="55"
        y="154"
        width="82"
        height="4"
        rx="1"
        fill="var(--main-page-illustration-base)"
      />
      <circle cx="68" cy="156" r="4" fill="var(--main-page-border)" />
      <circle
        cx="68"
        cy="156"
        r="2"
        fill="var(--main-page-illustration-body)"
      />
      <circle cx="124" cy="156" r="4" fill="var(--main-page-border)" />
      <circle
        cx="124"
        cy="156"
        r="2"
        fill="var(--main-page-illustration-body)"
      />
      <line
        x1="100"
        y1="22"
        x2="60"
        y2="22"
        stroke="var(--main-page-accent)"
        strokeWidth="0.8"
        opacity="0.4"
      />
      <defs>
        <linearGradient id="towerGrad" x1="0" y1="0" x2="1" y2="0">
          <stop
            offset="0"
            stopColor="var(--main-page-accent)"
            stopOpacity="0.08"
          />
          <stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function MainHero() {
  return (
    <section className="flex items-end justify-between gap-8 px-[clamp(20px,4vw,40px)] py-[clamp(44px,7vw,64px)] pb-12 animate-[main-page-fade-up_0.5s_ease_both] max-[960px]:flex-col max-[960px]:items-start">
      <div className="max-w-140">
        <div className="inline-flex items-center gap-2.5 mb-4.5 text-[11px] text-(--main-page-steel) uppercase tracking-[0.14em] before:content-[''] before:w-7.5 before:h-px before:bg-[linear-gradient(90deg,var(--main-page-accent),transparent)]">
          Region Control Desk
        </div>
        <h1 className="mt-0 text-[var(--main-page-title)] text-[clamp(3rem,3vw,5.2rem)] leading-[0.92] tracking-[0.06em] font-['Bebas_Neue',sans-serif]">
          {TEXT.titleLead}
        </h1>
        <h1 className="mt-2 text-[var(--main-page-accent)] text-[clamp(3rem,3vw,5.2rem)] leading-[0.92] tracking-[0.06em] font-['Bebas_Neue',sans-serif]">
          {TEXT.titleEmphasis}
        </h1>
        <p className="max-w-117.5 mt-4 text-[14px] leading-[1.75] text-(--main-page-steel)">
          {TEXT.description}
        </p>
      </div>
      <HeroCraneIllustration />
    </section>
  );
}
