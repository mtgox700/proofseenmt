/** A status as a tag: ink once agreed, amber while someone has to act, grey once over. Never green: a status is not a proof. */
const TONE: Readonly<Record<string, string>> = {
  pending: "tag-signal",
  submitted: "tag-signal",
  sent: "tag-signal",
  pending_signatures: "tag-signal",
  draft: "tag-quiet",
  accepted: "tag-done",
  active: "tag-done",
  shortlisted: "tag-done",
  completed: "tag-done",
  declined: "tag-quiet",
  rejected: "tag-quiet",
  withdrawn: "tag-quiet",
  cancelled: "tag-quiet",
  closed: "tag-quiet",
};

export function StatusTag({ status, label }: { readonly status: string; readonly label: string }) {
  return <span className={`tag ${TONE[status] ?? "tag-quiet"}`}>{label}</span>;
}
