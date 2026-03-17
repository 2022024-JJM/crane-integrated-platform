import type { Region } from "@/entities/region"

export function getRegionTitleKey(regionId: Region["id"]) {
  return `common:regions.${toRegionResourceKey(regionId)}.title`
}

export function getRegionSubtitleKey(regionId: Region["id"]) {
  return `common:regions.${toRegionResourceKey(regionId)}.subtitle`
}

export function getRegionLinkItems(regionId: Region["id"]) {
  const base = `/outdoor-work/${regionId}`

  return [
    {
      labelKey: "common:nav.realTimeMonitoring",
      path: `${base}/3d-monitoring`,
    },
    {
      labelKey: "common:nav.craneStatus",
      path: `${base}/crane-status`,
    },
  ]
}

function toRegionResourceKey(regionId: Region["id"]) {
  return regionId.replace("-", "")
}
