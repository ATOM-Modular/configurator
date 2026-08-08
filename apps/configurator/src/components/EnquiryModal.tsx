import { useState, type FormEvent } from "react";
import type { SiteConfig } from "@atom/contracts";

/**
 * Public CTA (SPEC): contact form + config JSON → webhook → n8n → HubSpot.
 * Webhook URL comes from VITE_ENQUIRY_WEBHOOK; without one the payload is
 * downloaded so the flow remains demonstrable.
 */
export function EnquiryModal({
  site,
  totalExGst,
  onClose,
}: {
  site: SiteConfig;
  totalExGst: number;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      contact: {
        name: data.get("name"),
        email: data.get("email"),
        phone: data.get("phone"),
        company: data.get("company"),
        notes: data.get("notes"),
      },
      indicativeTotal_exGst: totalExGst,
      config: site,
      submittedAt: new Date().toISOString(),
    };

    const webhook = import.meta.env.VITE_ENQUIRY_WEBHOOK as string | undefined;
    if (!webhook) {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "atom-enquiry.json";
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus("sent");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      setStatus(res.ok ? "sent" : "failed");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Get a detailed quote</h3>
        {status === "sent" ? (
          <>
            <p>Thanks — your configuration is on its way to our team.</p>
            <button className="primary" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Phone
              <input name="phone" />
            </label>
            <label>
              Company
              <input name="company" />
            </label>
            <label>
              Notes
              <textarea name="notes" rows={3} />
            </label>
            {status === "failed" && <p className="warn-inline">Send failed — try again.</p>}
            <div className="modal-actions">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="primary" type="submit" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send enquiry"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
