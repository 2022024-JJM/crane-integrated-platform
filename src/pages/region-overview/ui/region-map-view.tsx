import { Map } from "lucide-react";

export function RegionMapView() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 text-muted-foreground">
      <Map className="size-10 stroke-1" />
      <p className="text-sm font-medium">지도뷰 준비 중</p>
    </div>
  );
}
