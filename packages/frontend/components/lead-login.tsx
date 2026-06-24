"use client"

import { useState } from "react"
import { Loader2, LogIn, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { logAuthError, logAuthInfo } from "@/lib/auth/logger"
import { createClient } from "@/lib/supabase/client"

export function LeadLogin() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const redirectTo = `${globalThis.location.origin}/auth/callback?next=/admin`

    logAuthInfo("Starting Microsoft sign-in", { redirectTo })

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email",
        redirectTo,
      },
    })

    if (signInError) {
      logAuthError("Microsoft sign-in failed to start", {
        message: signInError.message,
        name: signInError.name,
      })
      setError(
        signInError.message ||
          "Could not start Microsoft sign-in. Check your Supabase configuration.",
      )
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="border-border bg-card hover:bg-secondary hover:text-foreground text-foreground uppercase tracking-wider text-xs px-6"
        onClick={() => setOpen(true)}
      >
        <User className="h-4 w-4 mr-2" />
        Lead Login
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Lead Sign In
            </DialogTitle>
            <DialogDescription>
              Sign in with your Cal Poly Microsoft account to access the admin
              dashboard.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="sm:min-w-40"
              onClick={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              Continue with Microsoft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
