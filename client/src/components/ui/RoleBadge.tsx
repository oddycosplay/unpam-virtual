import { ROLE_INFO, type Role } from "@unpam/shared";

export function RoleBadge({ role }: { role: Role }) {
  const info = ROLE_INFO[role];
  return (
    <span className="role-badge">
      <span className="role-swatches" aria-hidden>
        {info.colors.map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
      </span>
      {info.label}
    </span>
  );
}
