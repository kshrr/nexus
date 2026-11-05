export function RailPagination({ page, pages, onChange, label = 'Results pages' }) {
  if (pages <= 1) return null;
  return (
    <nav className="rail-pagination" aria-label={label}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        ← Previous
      </button>
      <span aria-live="polite">
        Page <strong>{page}</strong> of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  );
}
