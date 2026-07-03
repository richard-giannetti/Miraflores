"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelReservationAction,
  issueCheckInLinkAction,
  noShowAction,
} from "../actions";

export function DetailActions({
  id,
  status,
  hasEmail,
  existingLink,
}: {
  id: string;
  status: string;
  hasEmail: boolean;
  existingLink: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(existingLink);
  const [copied, setCopied] = useState(false);

  const active = status === "CONFIRMED" || status === "CHECKED_IN";

  return (
    <div className="space-y-3">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Online check-in link</h3>
        {link ? (
          <div className="space-y-2">
            <input readOnly value={link} className="input text-xs" onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending || !active}
            className="btn-secondary w-full"
            onClick={() => start(async () => { const { url } = await issueCheckInLinkAction(id); setLink(url); })}
          >
            {pending ? "Generating…" : "Generate check-in link"}
          </button>
        )}
        {!hasEmail && <p className="mt-1 text-xs text-amber-600">No guest email on file — share the link manually.</p>}
      </div>

      {active && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            disabled={pending}
            className="btn-danger w-full"
            onClick={() => { if (confirm("Cancel this reservation? The room becomes available again.")) start(async () => { await cancelReservationAction(id); router.refresh(); }); }}
          >
            Cancel reservation
          </button>
          {status === "CONFIRMED" && (
            <button
              type="button"
              disabled={pending}
              className="btn-secondary w-full"
              onClick={() => { if (confirm("Mark this reservation as a no-show?")) start(async () => { await noShowAction(id); router.refresh(); }); }}
            >
              Mark no-show
            </button>
          )}
        </div>
      )}
    </div>
  );
}
