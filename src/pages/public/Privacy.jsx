/**
 * Privacy notice (ui-spec §3.16, `[SECURITY]`). Plain language a 17-year-old
 * will read. Full PDPA-aligned copy is finalised in a later phase
 * (requirements.md §13.8); this is the structural stub.
 */
export function Privacy() {
  return (
    <article className="mx-auto max-w-prose px-4 py-12 text-body text-ink-900">
      <h1 className="text-h1 font-serif">Privacy notice</h1>
      <p className="mt-2 text-body-sm text-ink-500">Draft — to be finalised before launch.</p>

      <h2 className="mt-8 text-h3 font-sans">What we collect</h2>
      <p className="mt-2 text-ink-700">
        Your name and email (for your account), your education level and career goals, and — if you
        are an SPM leaver — the subject grades you enter. Nothing else. We do not collect your IC
        number, phone number, address, or household income.
      </p>

      <h2 className="mt-6 text-h3 font-sans">Why we collect it</h2>
      <p className="mt-2 text-ink-700">
        To work out course, career and scholarship suggestions that fit you, and to show you which
        scholarship requirements you meet.
      </p>

      <h2 className="mt-6 text-h3 font-sans">The AI assistant</h2>
      <p className="mt-2 text-ink-700">
        When you use the chat assistant, a short summary of your profile is sent to Google’s Gemini
        service to generate a reply. Your grades and email are never sent.
      </p>

      <h2 className="mt-6 text-h3 font-sans">Your control</h2>
      <p className="mt-2 text-ink-700">
        You can edit your profile any time, download a copy of your data, and permanently delete
        your account and everything tied to it from the Profile page.
      </p>
    </article>
  );
}

export default Privacy;
