import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout, PageHeader } from "@/components/PublicLayout";

export const Route = createFileRoute("/docs/self-hosting")({
  head: () => ({
    meta: [
      { title: "Self-Hosting Guide — CivicLedger Legislative Management" },
      {
        name: "description",
        content:
          "Step-by-step guide to self-hosting CivicLedger: database, environment variables, build, deploy, first administrator and ongoing operations.",
      },
      { property: "og:title", content: "Self-Hosting CivicLedger" },
      {
        property: "og:description",
        content: "Run your own instance of the agenda, ordinance and minutes platform.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SelfHosting,
});

function SelfHosting() {
  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Documentation"
        title="Self-hosting guide"
        description="CivicLedger is a TanStack Start application backed by a Postgres database with row-level security. Everything below runs on infrastructure you control."
      />

      <article className="mx-auto max-w-3xl space-y-10 px-5 py-12">
        <Section n="1" title="What you need">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Node.js 20+ (or Bun 1.1+) and Git on the build machine.</li>
            <li>
              A Postgres database with the Supabase stack (Auth + PostgREST). Either Supabase Cloud
              or a self-hosted Supabase deployment via <Code>docker compose</Code>.
            </li>
            <li>
              A host for the web app: any Node server, container platform, or an edge runtime such
              as Cloudflare Workers.
            </li>
            <li>An SMTP provider if you want password resets and email notices.</li>
          </ul>
        </Section>

        <Section n="2" title="Get the code">
          <Pre>{`git clone <your-fork-url> civicledger
cd civicledger
npm install     # or: bun install`}</Pre>
        </Section>

        <Section n="3" title="Stand up the database">
          <p>
            For a fully self-hosted backend, run the official Supabase Docker bundle, which brings
            Postgres, GoTrue (auth), PostgREST (the data API) and Storage:
          </p>
          <Pre>{`git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env      # set POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
docker compose up -d`}</Pre>
          <p>
            Then apply the CivicLedger schema. Every migration lives in{" "}
            <Code>supabase/migrations</Code> and is plain SQL, applied in filename order:
          </p>
          <Pre>{`npx supabase link --project-ref <ref>   # cloud
npx supabase db push

# or, against any Postgres URL:
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done`}</Pre>
          <p>
            The migrations create the bodies, seats, item types, numbering rules, vote rules,
            legislative files, meetings, agendas, motions, votes, minutes and audit tables, plus the
            row-level-security policies and the <Code>assign_item_number</Code> numbering function.
          </p>
        </Section>

        <Section n="4" title="Configure environment variables">
          <p>
            Browser-visible values are prefixed <Code>VITE_</Code>. Everything else is server-only
            and must never be exposed to the client.
          </p>
          <Pre>{`# .env
VITE_SUPABASE_URL=https://db.your-domain.gov
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>

SUPABASE_URL=https://db.your-domain.gov
SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — server only>`}</Pre>
          <p>
            The service-role key bypasses row-level security. Keep it in your host's secret store,
            never in the repository or in any <Code>VITE_</Code> variable.
          </p>
        </Section>

        <Section n="5" title="Build and run">
          <Pre>{`npm run dev             # local development on http://localhost:8080
npm run build           # production build
node .output/server/index.mjs   # serve the build`}</Pre>
          <p>
            The build output is a standard server bundle plus static assets. To deploy to Cloudflare
            Workers instead, keep the default Nitro Cloudflare preset and publish with{" "}
            <Code>wrangler deploy</Code>. Put the app behind TLS and your municipality's domain.
          </p>
        </Section>

        <Section n="6" title="Create the first administrator">
          <p>
            Register through <Link to="/auth" className="text-seal underline">the staff sign-in page</Link>, then grant
            yourself the admin role directly in the database — roles are stored in a dedicated{" "}
            <Code>user_roles</Code> table, never on the profile, so they cannot be escalated from
            the client:
          </p>
          <Pre>{`insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'clerk@your-city.gov';`}</Pre>
          <p>
            After that, every other role (clerk, attorney, department staff, board member, viewer)
            is assigned from the administration portal.
          </p>
        </Section>

        <Section n="7" title="Configure your municipality">
          <p>Sign in and work through Administration in order:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Municipality settings — name, clerk contact, notice days, posting deadline.</li>
            <li>Bodies — council, commissions and boards, with seat counts and quorum rules.</li>
            <li>Members and seats — who occupies each seat, for roll call and voting.</li>
            <li>Item types — ordinance, resolution, proclamation; readings and hearing rules.</li>
            <li>Vote rules — fraction, basis, abstention handling, recusal treatment.</li>
            <li>Numbering — patterns such as <Code>{"{YYYY}-{seq:000}"}</Code> and reset policy.</li>
          </ol>
        </Section>

        <Section n="8" title="Backups and operations">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Nightly logical backups: <Code>pg_dump --format=custom</Code>, retained off-site for
              at least as long as your records-retention schedule requires.
            </li>
            <li>
              Generated agenda packets and minutes are versioned; every download is logged in{" "}
              <Code>document_exports</Code> with its version and filename for the official record.
            </li>
            <li>
              The <Code>audit_log</Code> table records number assignments and workflow actions —
              never truncate it.
            </li>
            <li>
              Upgrades: pull, run new migrations, rebuild, restart. Migrations are additive and
              ordered.
            </li>
          </ul>
        </Section>

        <Section n="9" title="Licensing and support">
          <p>
            Self-hosted instances receive no warranty. Before adopting CivicLedger as the system of
            record, confirm with your attorney that the retention, notice and open-meeting
            requirements of your jurisdiction are satisfied by your configuration.
          </p>
        </Section>
      </article>
    </PublicLayout>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-foreground">
        <span className="docnum mr-2 text-muted-foreground">{n}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[0.95rem] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="docnum rounded-sm bg-secondary px-1.5 py-0.5 text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-sm border border-rule bg-secondary p-4 font-mono text-xs leading-relaxed text-foreground">
      {children}
    </pre>
  );
}
