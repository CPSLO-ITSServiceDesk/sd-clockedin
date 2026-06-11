"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function LoginArea() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [leadId, setLeadId] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = () => {
    if (leadId.trim() && password.trim()) {
      setLeadId("")
      setPassword("")
      setIsOpen(false)
      router.push("/admin")
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="border-border bg-card hover:bg-secondary hover:text-foreground text-foreground font-mono uppercase tracking-wider text-xs px-6"
        >
          <svg
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Lead Login
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 bg-card border-border p-0"
        align="end"
        sideOffset={8}
      >
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold text-card-foreground">Lead Login</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Access administrative controls
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="lead-id"
              className="text-xs uppercase tracking-wider text-muted-foreground font-medium"
            >
              Lead ID
            </label>
            <Input
              id="lead-id"
              placeholder="Enter Lead ID..."
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="lead-password"
              className="text-xs uppercase tracking-wider text-muted-foreground font-medium"
            >
              Password
            </label>
            <Input
              id="lead-password"
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLogin()
                }
              }}
            />
          </div>
          <Button
            onClick={handleLogin}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-mono uppercase tracking-wider text-xs"
          >
            Login
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
