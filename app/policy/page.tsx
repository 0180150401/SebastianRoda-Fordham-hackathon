import Link from "next/link";

export default function PolicyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
        ← Back
      </Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        This is a placeholder privacy policy for the 6 degree&apos;s / NOEM demo. Replace with your
        legal text before production. Contact:{" "}
        <a className="text-foreground underline" href="mailto:hello@noemtech.com">
          hello@noemtech.com
        </a>
        .
      </p>
    </main>
  );
}
