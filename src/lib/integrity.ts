/**
 * Record integrity helpers.
 *
 * Finalized minutes are hashed with SHA-256 so that any later alteration of the
 * stored text is detectable. The hash is stored alongside the certification and
 * republished on the public record, letting anyone re-compute and compare.
 */

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Groups a hex digest into readable 8-character blocks. */
export function formatHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return (hash.match(/.{1,8}/g) ?? [hash]).join(" ");
}

export async function verifyHash(text: string, hash: string | null | undefined) {
  if (!hash) return { verified: false, computed: null as string | null };
  const computed = await sha256Hex(text);
  return { verified: computed === hash, computed };
}
