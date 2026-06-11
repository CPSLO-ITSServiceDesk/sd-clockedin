import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <>
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground text-sm">
              Configure system preferences and settings
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* General Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Switch
                  defaultChecked
                  className="h-4 w-6"
                />
                <Label className="text-sm font-medium text-muted-foreground">
                  Enable notifications
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Switch
                  defaultChecked={false}
                  className="h-4 w-6"
                />
                <Label className="text-sm font-medium text-muted-foreground">
                  Auto-clock out after shift end
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Switch
                  defaultChecked
                  className="h-4 w-6"
                />
                <Label className="text-sm font-medium text-muted-foreground">
                  Allow shift swaps
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Email Notifications</Label>
                <Switch
                  defaultChecked
                  className="h-4 w-6"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">SMS Notifications</Label>
                <Switch
                  defaultChecked={false}
                  className="h-4 w-6"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">In-app Notifications</Label>
                <Switch
                  defaultChecked
                  className="h-4 w-6"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">System Name</Label>
              <Input
                defaultValue="SD-ClockedIn"
                placeholder="Enter system name"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Time Zone</Label>
              <Input
                defaultValue="UTC"
                placeholder="Select time zone"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Date Format</Label>
              <Input
                defaultValue="MM/DD/YYYY"
                placeholder="Select date format"
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Button variant="outline">
            Cancel
          </Button>
          <Button className="btn-primary">
            Save Settings
          </Button>
        </div>
      </div>
    </>
  )
}