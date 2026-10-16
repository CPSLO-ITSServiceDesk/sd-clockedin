"use client"

import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { useAdminSession } from "@/hooks/use-admin-session"
import {
  adminsApi,
  getAdminDisplayName,
  getAdminInitials,
  isAdminActive,
  type Admin,
} from "@/lib/api/admins"
import { getOrgLocalDateString } from "@/lib/org-time"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_90px_150px_220px] gap-x-3 gap-y-1"

const INPUT =
  "h-[38px] min-w-0 rounded-xl border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40"

type Fields = { email: string; first: string; last: string }

const EMPTY_FIELDS: Fields = { email: "", first: "", last: "" }

function formatLastSignIn(value: string | null): string {
  if (!value) return "Never signed in"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Never signed in"
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  const day = getOrgLocalDateString(date)
  const today = getOrgLocalDateString()
  const yesterday = getOrgLocalDateString(new Date(Date.now() - 86_400_000))
  if (day === today) return `Today, ${time}`
  if (day === yesterday) return `Yesterday, ${time}`
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  })}, ${time}`
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function validateEmail(value: string, admins: Admin[], ignoreId?: number): string | null {
  const email = value.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address."
  if (admins.some((admin) => admin.id !== ignoreId && admin.email?.toLowerCase() === email)) {
    return `${email} already has access.`
  }
  return null
}

export function AdminAccessManager() {
  const queryClient = useQueryClient()
  const { email: myEmail } = useAdminSession()
  const [query, setQuery] = useState("")
  const [form, setForm] = useState<Fields>(EMPTY_FIELDS)
  const [formError, setFormError] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ id: number; fields: Fields; error: string | null } | null>(null)

  const { data: admins = [], isLoading, error } = useQuery({
    queryKey: queryKeys.admins.all,
    queryFn: adminsApi.list,
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.admins.all })
  const isMe = (admin: Admin) => Boolean(myEmail) && admin.email?.toLowerCase() === myEmail.toLowerCase()

  const createMutation = useMutation({
    mutationFn: (fields: Fields) =>
      adminsApi.create({
        email: fields.email.trim().toLowerCase(),
        first_name: fields.first.trim() || null,
        last_name: fields.last.trim() || null,
        isactive: true,
      }),
    onSuccess: async (admin) => {
      await invalidate()
      setAddedId(admin.id)
      setForm(EMPTY_FIELDS)
      toast.success(`${admin.email} can now sign in`)
    },
    onError: (err) => setFormError(errorMessage(err, "Couldn't add this admin.")),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof adminsApi.update>[1] }) =>
      adminsApi.update(id, patch),
    onSuccess: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => adminsApi.remove(id),
    onSuccess: async () => {
      await invalidate()
      setConfirmingId(null)
      toast.success("Access removed")
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't remove this admin.")),
  })

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    const problem = validateEmail(form.email, admins)
    if (problem) return setFormError(problem)
    createMutation.mutate(form)
  }

  const toggleActive = (admin: Admin) =>
    updateMutation.mutate(
      { id: admin.id, patch: { isactive: !isAdminActive(admin) } },
      {
        onSuccess: () => toast.success(isAdminActive(admin) ? "Access paused" : "Access restored"),
        onError: (err) => toast.error(errorMessage(err, "Couldn't update this admin.")),
      },
    )

  const saveEdit = () => {
    if (!editing) return
    const problem = validateEmail(editing.fields.email, admins, editing.id)
    if (problem) return setEditing({ ...editing, error: problem })
    updateMutation.mutate(
      {
        id: editing.id,
        patch: {
          email: editing.fields.email.trim().toLowerCase(),
          first_name: editing.fields.first.trim() || null,
          last_name: editing.fields.last.trim() || null,
        },
      },
      {
        onSuccess: () => setEditing(null),
        onError: (err) => setEditing((current) => current && { ...current, error: errorMessage(err, "Couldn't save.") }),
      },
    )
  }

  const q = query.trim().toLowerCase()
  const rows = admins
      .filter(
        (admin) =>
          !q || getAdminDisplayName(admin).toLowerCase().includes(q) || (admin.email ?? "").toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          Number(isMe(b)) - Number(isMe(a)) ||
          Number(isAdminActive(b)) - Number(isAdminActive(a)) ||
          getAdminDisplayName(a).localeCompare(getAdminDisplayName(b)),
      )

  const activeCount = admins.filter(isAdminActive).length
  const inactiveCount = admins.length - activeCount

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Admin access</h1>
        <p className="text-sm text-muted-foreground">
          People who can sign in to this dashboard. Access is checked against their email when they sign in.
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-[20px] border border-border bg-card px-5 py-[18px]"
      >
        <span className="text-[15px] font-bold">Give someone access</span>
        <div className="grid items-end gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-semibold text-muted-foreground">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => {
                setForm({ ...form, email: event.target.value })
                setFormError(null)
              }}
              placeholder="name@calpoly.edu"
              aria-invalid={formError ? true : undefined}
              className={cn(INPUT, formError && "border-destructive")}
            />
          </label>
          {(
            [
              ["first", "First name"],
              ["last", "Last name"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                {label} <span className="font-medium text-muted-foreground/70">optional</span>
              </span>
              <input
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                className={INPUT}
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="h-[38px] whitespace-nowrap rounded-full bg-accent px-[18px] text-[13px] font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Adding..." : "Add admin"}
          </button>
        </div>
        {formError ? (
          <span className="text-[13px] font-semibold text-destructive" role="alert">
            {formError}
          </span>
        ) : null}
      </form>

      <section className="overflow-hidden rounded-[20px] border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <span className="text-[15px] font-bold">
            {activeCount} with access{inactiveCount > 0 ? ` · ${inactiveCount} inactive` : ""}
          </span>
          <label className="flex h-[34px] w-full items-center gap-2 rounded-full border border-border bg-muted/50 px-3 sm:w-[260px]">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or email"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        <div
          className={cn(
            ROW_GRID,
            "hidden border-y border-border/60 bg-muted/40 px-5 py-2 text-xs font-semibold text-muted-foreground md:grid",
          )}
        >
          <span>Name</span>
          <span>Email</span>
          <span>Status</span>
          <span>Last sign-in</span>
          <span />
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-destructive">{errorMessage(error, "Couldn't load admins.")}</p>
        ) : isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading admins...</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {admins.length === 0 ? "No admins yet. Add an email above to give someone access." : "No one matches that search."}
          </p>
        ) : (
          rows.map((admin) => {
            const me = isMe(admin)
            const active = isAdminActive(admin)
            const invited = active && !admin.last_login
            const confirming = confirmingId === admin.id
            const edit = editing?.id === admin.id ? editing : null

            if (edit) {
              const setField = (key: keyof Fields, value: string) =>
                setEditing({ ...edit, fields: { ...edit.fields, [key]: value }, error: null })
              return (
                <div key={admin.id} className="flex flex-col gap-2 border-b border-border/60 bg-muted/30 px-5 py-3 last:border-0">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                    <input aria-label="First name" placeholder="First name" value={edit.fields.first} onChange={(event) => setField("first", event.target.value)} className={INPUT} />
                    <input aria-label="Last name" placeholder="Last name" value={edit.fields.last} onChange={(event) => setField("last", event.target.value)} className={INPUT} />
                    <input aria-label="Email" type="email" value={edit.fields.email} onChange={(event) => setField("email", event.target.value)} className={cn(INPUT, edit.error && "border-destructive")} />
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => setEditing(null)} className="h-7 rounded-full border border-border bg-card px-2.5 text-xs font-semibold hover:bg-muted">
                        Cancel
                      </button>
                      <button type="button" onClick={saveEdit} disabled={updateMutation.isPending} className="h-7 rounded-full bg-accent px-3 text-xs font-bold text-accent-foreground disabled:opacity-50">
                        Save
                      </button>
                    </div>
                  </div>
                  {me && edit.fields.email.trim().toLowerCase() !== myEmail.toLowerCase() ? (
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      Changing your own email means you&apos;ll need to sign in with the new address.
                    </span>
                  ) : null}
                  {edit.error ? <span className="text-xs font-semibold text-destructive">{edit.error}</span> : null}
                </div>
              )
            }

            return (
              <div
                key={admin.id}
                className={cn(
                  ROW_GRID,
                  "items-center border-b border-border/60 px-5 py-3 last:border-0",
                  confirming ? "bg-destructive/5" : admin.id === addedId ? "bg-accent/5" : "",
                  !active && "opacity-65",
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      me
                        ? "bg-sky-500/15 text-sky-800 dark:text-sky-200"
                        : invited
                          ? "border-[1.5px] border-dashed border-border bg-card"
                          : "bg-muted",
                    )}
                  >
                    {getAdminInitials(admin)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold">{getAdminDisplayName(admin)}</span>
                      {me ? (
                        <span className="shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:text-sky-200">
                          You
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground md:hidden">{admin.email}</span>
                  </span>
                </div>
                <span className="hidden truncate text-[13px] text-muted-foreground md:inline">{admin.email ?? "—"}</span>
                <span
                  className={cn(
                    "hidden justify-self-start rounded-full px-2 py-0.5 text-[11px] font-bold md:inline",
                    !active
                      ? "bg-muted text-muted-foreground"
                      : invited
                        ? "border border-border bg-card text-foreground/80"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  {!active ? "Inactive" : invited ? "Invited" : "Active"}
                </span>
                <span className="hidden font-mono text-xs text-muted-foreground md:inline">
                  {formatLastSignIn(admin.last_login)}
                </span>
                {confirming ? (
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-xs font-semibold text-destructive">Remove?</span>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="h-7 rounded-full border border-border bg-card px-2.5 text-xs font-semibold hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(admin.id)}
                      disabled={removeMutation.isPending}
                      className="h-7 rounded-full bg-destructive px-2.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          id: admin.id,
                          fields: { email: admin.email ?? "", first: admin.first_name ?? "", last: admin.last_name ?? "" },
                          error: null,
                        })
                      }
                      className="h-7 rounded-full px-2.5 text-xs font-semibold text-accent hover:bg-muted"
                    >
                      Edit
                    </button>
                    {me ? null : (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleActive(admin)}
                          disabled={updateMutation.isPending}
                          className="h-7 rounded-full px-2.5 text-xs font-semibold text-foreground/80 hover:bg-muted"
                        >
                          {active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(admin.id)}
                          className="h-7 rounded-full px-2.5 text-xs font-semibold text-destructive hover:bg-muted"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}
