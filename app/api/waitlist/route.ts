/**
 * POST /api/waitlist
 * Persists email to Supabase `public.waitlist` (service role) and notifies via Resend.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { NextResponse } from "next/server";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? String((body as { email: unknown }).email ?? "").trim()
      : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const normalized = email.toLowerCase();

  let savedToDb = false;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("waitlist").insert({ email: normalized });
      if (error?.code === "23505") {
        savedToDb = true;
      } else if (!error) {
        savedToDb = true;
      } else {
        console.error("[waitlist] supabase insert", error);
      }
    } catch (e) {
      console.error("[waitlist] supabase", e);
    }
  }

  const to = process.env.CONTACT_TO_EMAIL ?? "hello@noemtech.com";
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";

  const html = `
    <p><strong>Waitlist signup</strong> (6 degree&apos;s)</p>
    <p><strong>Email:</strong> ${escapeHtml(normalized)}</p>
  `;
  const text = `Waitlist signup (6 degree's)\n\nEmail: ${normalized}`;

  if (apiKey) {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: `Waitlist: ${normalized}`,
      html,
      text,
    });
    if (error) {
      console.error("[waitlist]", error);
      return NextResponse.json({ error: "Could not send email. Try again later." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, sent: true, savedToDb });
  }

  console.warn("[waitlist] RESEND_API_KEY not set; logging request:", { email: normalized, to });
  return NextResponse.json({
    ok: true,
    sent: false,
    savedToDb,
    message: "Request received (configure RESEND_API_KEY to deliver email).",
  });
}
