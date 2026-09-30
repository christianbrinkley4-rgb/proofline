"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createTokenAction, revokeTokenAction } from "@/app/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { onTabListKeyDown } from "@/components/shared/tab-keys";

export type TokenView = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };

const CLIENTS = ["Claude Code", "Claude Desktop", "Cursor"] as const;
type Client = (typeof CLIENTS)[number];

function setup(client: Client, url: string, token: string): string {
  if (client === "Claude Code") return `claude mcp add --transport http proofline ${url} --header "Authorization: Bearer ${token}"`;
  if (client === "Cursor") {
    return JSON.stringify({ mcpServers: { proofline: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);
  }
  return JSON.stringify(
    { mcpServers: { proofline: { command: "npx", args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${token}`] } } },
    null,
    2,
  );
}

const WHERE: Record<Client, string> = {
  "Claude Code": "Run this in your terminal.",
  "Claude Desktop": "Add this to claude_desktop_config.json (Settings, Developer, Edit config), then restart Claude.",
  Cursor: "Add this to ~/.cursor/mcp.json.",
};

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function AiConnections({ tokens, mcpUrl }: { tokens: TokenView[]; mcpUrl: string }) {
  const router = useRouter();
  const [name, setName] = useState("Claude");
  const [fresh, setFresh] = useState<string | null>(null);
  const [client, setClient] = useState<Client>("Claude Code");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const snippet = setup(client, mcpUrl, fresh ?? "<your token>");

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          startTransition(async () => {
            const result = await createTokenAction(name);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setFresh(result.token);
            setCopied(false);
            router.refresh();
          });
        }}
      >
        <label className="min-w-0 flex-1 space-y-1.5 text-[12.5px]">
          <span>Name this connection</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Claude, ChatGPT, Cursor..." />
        </label>
        <Button type="submit" disabled={pending || !name.trim()}>
          <Plus data-icon="inline-start" />
          Create token
        </Button>
      </form>
      {error && <p role="alert" className="text-[12.5px] text-destructive">{error}</p>}

      {fresh && (
        <div className="rounded-lg border border-pending/40 bg-pending-soft p-3.5">
          <p className="text-[13px] font-medium text-pending-ink">Copy this token now. It won&apos;t be shown again.</p>
          <div className="mt-2 flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-2.5 py-1.5 font-mono text-[12px]">{fresh}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(fresh);
                setCopied(true);
              }}
            >
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        <div role="tablist" aria-label="Set up with" onKeyDown={onTabListKeyDown} className="flex gap-1 border-b p-1.5">
          {CLIENTS.map((c) => (
            <button
              key={c}
              role="tab"
              type="button"
              aria-selected={client === c}
              tabIndex={client === c ? 0 : -1}
              onClick={() => setClient(c)}
              className={cn("rounded-md px-2.5 py-1 text-[12.5px]", client === c ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="p-3">
          <p className="text-[12.5px] text-muted-foreground">{WHERE[client]}</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-[11.5px] leading-5 whitespace-pre-wrap break-all">{snippet}</pre>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={async () => {
              await navigator.clipboard.writeText(snippet);
              toast(fresh ? "Copied with your token filled in." : "Copied. Create a token and paste it in.");
            }}
          >
            <Copy data-icon="inline-start" />
            Copy setup
          </Button>
        </div>
      </div>

      {tokens.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 text-[13px]">
              <KeyRound className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{t.name}</span>{" "}
                <span className="font-mono text-[11.5px] text-subtle-foreground">{t.prefix}…</span>
                <span className="block text-[11.5px] text-muted-foreground">
                  Created {when(t.createdAt)} · {t.lastUsedAt ? `last used ${when(t.lastUsedAt)}` : "not used yet"}
                </span>
              </span>
              {confirming === t.id ? (
                <span className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await revokeTokenAction(t.id);
                        setConfirming(null);
                        toast(`${t.name} disconnected.`);
                        router.refresh();
                      })
                    }
                  >
                    Revoke
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                    Keep
                  </Button>
                </span>
              ) : (
                <Button size="icon-sm" variant="ghost" aria-label={`Revoke ${t.name}`} onClick={() => setConfirming(t.id)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
