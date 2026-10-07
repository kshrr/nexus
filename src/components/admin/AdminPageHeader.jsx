/**
 * Heading block for an admin screen. Denser than the student PageHeader —
 * admins get a title, one line of context, and their actions (ui-spec §10).
 *
 * @param {{ title: string, description?: string, actions?: React.ReactNode }} props
 */
export function AdminPageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-h1 font-serif">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-body-sm text-ink-700">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export default AdminPageHeader;
