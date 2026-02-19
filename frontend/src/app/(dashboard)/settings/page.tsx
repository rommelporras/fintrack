"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface User {
  id: string;
  email: string;
  name: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<User>("/auth/me").then((u) => {
      setUser(u);
      setName(u.name);
    });
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/auth/me", { name });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <Button type="submit" disabled={saving}>
              {saved ? "Saved!" : saving ? "Saving…" : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Gemini API Key</Label>
            <Input
              type="password"
              placeholder="AIza…"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label>Claude API Key</Label>
            <Input
              type="password"
              placeholder="sk-ant-…"
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Used for AI-powered receipt scanning in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
