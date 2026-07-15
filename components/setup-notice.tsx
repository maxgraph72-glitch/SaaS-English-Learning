export function SetupNotice() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <span className="brand-mark">D</span>
        <p className="eyebrow">One local step remains</p>
        <h1>Connect Daily English to Supabase</h1>
        <p>
          Copy the two public variable names from <code>.env.example</code> into
          your local environment, then apply the Supabase migration. Secret and
          service-role keys are not used by the browser.
        </p>
      </section>
    </main>
  );
}
