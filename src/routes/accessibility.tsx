import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, PageHeader, useSettings } from "@/components/PublicLayout";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: "Accessibility Statement — Public Legislative Portal" },
      {
        name: "description",
        content:
          "How this legislative portal meets WCAG 2.1 AA, how to request an accessible format of an agenda or minutes, and how to report a barrier.",
      },
      { property: "og:title", content: "Accessibility Statement" },
      {
        property: "og:description",
        content:
          "WCAG 2.1 AA conformance, accessible formats of public records, and how to report accessibility barriers.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessibilityPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="border-b border-rule pb-2 font-display text-xl font-bold text-foreground">
        {title}
      </h2>
      <div className="space-y-3 pt-4 text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  );
}

function AccessibilityPage() {
  const { data: settings } = useSettings();
  const city = settings?.municipality_name ?? "The municipality";
  const contact = settings?.contact_email;

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Accessibility"
        title="Accessibility statement"
        description={`${city} is committed to making its legislative record usable by everyone, including residents who use screen readers, magnification, captioning or keyboard-only navigation.`}
      />

      <div className="mx-auto max-w-3xl px-5 pb-16">
        <Section title="Standard we follow">
          <p>
            This portal is designed and maintained to conform with the Web Content Accessibility
            Guidelines (WCAG) 2.1, Level AA, the standard referenced by Section 508 of the
            Rehabilitation Act and by Title II of the Americans with Disabilities Act. This page is
            maintained by the Clerk&apos;s office and describes current practice; it is not an
            independent certification or audit result.
          </p>
        </Section>

        <Section title="What we do">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Every agenda, packet and set of minutes is published as an HTML page as well as a PDF,
              so the record can be read without downloading a document. Use the &ldquo;Text
              version&rdquo; link on any meeting page.
            </li>
            <li>
              Pages use one main heading, semantic landmarks, a skip-to-content link, visible focus
              indicators and text contrast that meets AA thresholds.
            </li>
            <li>
              All functionality — filing a comment card, requesting to speak, searching legislation,
              filing a records request — is operable with a keyboard alone.
            </li>
            <li>
              Meeting video and audio links indicate whether captions are available; the caption
              status is shown next to each recording.
            </li>
            <li>
              Status is never conveyed by color alone; every badge carries a text label.
            </li>
          </ul>
        </Section>

        <Section title="Known limitations">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Scanned exhibits, maps and third-party attachments submitted by outside parties may
              not carry a text layer. We will provide an accessible equivalent on request.
            </li>
            <li>
              Live meeting video is hosted by third-party providers; caption quality on live streams
              depends on that provider.
            </li>
          </ul>
        </Section>

        <Section title="Requesting an accessible format or accommodation">
          <p>
            Any record on this site is available in large print, plain text, braille-ready or other
            accessible format at no charge. Requests for an interpreter, assistive listening device
            or other accommodation at a public meeting should be made as early as possible so
            arrangements can be confirmed before the meeting.
          </p>
          <p>
            Contact the Clerk&apos;s office
            {contact ? (
              <>
                {" "}
                at{" "}
                <a className="text-seal underline" href={`mailto:${contact}`}>
                  {contact}
                </a>
              </>
            ) : null}
            . You may also file a request through the{" "}
            <a className="text-seal underline" href="/records-requests">
              public records portal
            </a>
            .
          </p>
        </Section>

        <Section title="Reporting a barrier">
          <p>
            If you encounter a page, document or feature you cannot use, tell us the page address,
            the assistive technology you were using and what happened. We acknowledge accessibility
            reports on the same schedule as public records requests and will provide the content in
            an accessible form while the underlying issue is corrected.
          </p>
        </Section>
      </div>
    </PublicLayout>
  );
}
