import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AppLayout } from "@/shared/ui/organisms/app-layout"
import { DashboardPage, RegionOverviewPage, OutdoorWorkPage } from "@/pages"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="region-overview" element={<RegionOverviewPage />} />
          <Route path="outdoor-work/:regionId/*" element={<OutdoorWorkPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
