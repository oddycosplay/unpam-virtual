import { SUBMISSION_STATUS_LABEL, type SubmissionStatus } from "@unpam/shared";

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return <span className={`status-badge st-${status}`}>{SUBMISSION_STATUS_LABEL[status]}</span>;
}
