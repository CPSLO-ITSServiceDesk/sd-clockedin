import { redirect } from "next/navigation"

export default async function LegacyStudentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>
}) {
  const { student } = await searchParams
  const params = new URLSearchParams({ tab: "analytics" })
  if (student) {
    params.set("student", student)
  }
  redirect(`/admin/studentrecords?${params.toString()}`)
}
