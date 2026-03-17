import { useTranslation } from "react-i18next"

export function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{t("dashboard:title")}</h1>
      <p className="mt-1 text-muted-foreground">
        {t("dashboard:description")}
      </p>
    </div>
  )
}
