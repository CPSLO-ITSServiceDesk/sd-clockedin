"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SlackScheduleCardProps {
  slackText: string
  slackCount: number
  isLoading?: boolean
}

export function SlackScheduleCard({
  slackText,
  slackCount,
  isLoading = false,
}: SlackScheduleCardProps) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopy = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setCopyError(false)

    try {
      await navigator.clipboard.writeText(slackText)
      setCopied(true)
      timeoutRef.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
      setCopyError(true)
      timeoutRef.current = setTimeout(() => setCopyError(false), 2500)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle>Slack schedule</CardTitle>
          <CardDescription>
            Sorted by start time, then first name
            {!isLoading ? ` · ${slackCount} lines` : ""}
            {copyError ? " · Copy failed — try again" : ""}
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant={copied ? "outline" : "default"}
          onClick={handleCopy}
          disabled={isLoading || !slackText}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading schedule...
          </div>
        ) : (
          <pre className="max-h-[340px] overflow-auto rounded-md border border-border bg-muted/40 px-4 py-3 font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {slackText || "No scheduled shifts to copy."}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}
