/**
 * Heading block for an admin screen. Denser than the student PageHeader —
 * admins get a title, one line of context, and their actions (ui-spec §10).
 *
 * @param {{ title: string, description?: string, actions?: React.ReactNode }} props
 */
export function AdminPageHeader({ title, description, actions }) {
  return (
    <header className="admin-page-banner">
      <div className="admin-banner-copy">
        <p className="admin-banner-eyebrow">
          <span aria-hidden="true">N</span> NEXUS / ADMINISTRATION
        </p>
        <h1>{title}</h1>
        {description && <p className="admin-banner-description">{description}</p>}
      </div>
      {actions && <div className="admin-banner-actions">{actions}</div>}
      <div className="admin-banner-track" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </header>
  );
}

export default AdminPageHeader;
