import { HanwhaIcon } from '@crane/ui/atoms/hanwha-icon';

export function LoginBrandingPanel() {
  return (
    <div
      className="relative hidden w-85 shrink-0 flex-col items-center justify-center gap-6 p-10 md:flex"
      style={{
        background: 'linear-gradient(160deg, #1c2236 0%, #111520 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="absolute top-8 right-8 h-32 w-32 rounded-full opacity-20 blur-2xl"
        style={{ background: 'radial-gradient(circle, #f97316, transparent)' }}
      />
      <div
        className="absolute bottom-12 left-6 h-24 w-24 rounded-full opacity-15 blur-2xl"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
      />

      <div className="relative flex flex-col items-center gap-4">
        <HanwhaIcon width={72} height={72} />
        <div className="text-center">
          <p className="text-3xl font-bold tracking-tight text-white">Crane</p>
          <p className="mt-1 text-xs font-medium tracking-widest text-white/40 uppercase">
            Management Platform
          </p>
        </div>
      </div>

      <div className="h-px w-12 bg-white/10" />

      <p className="text-center text-sm leading-relaxed text-white/40">
        Integrated crane monitoring<br />and management solution
      </p>
    </div>
  );
}
