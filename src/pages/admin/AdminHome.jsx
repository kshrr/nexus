import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert, Badge, Button, Card, EmptyState, Icon } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/feedback';
import { useAdminOverview, useCrawlRunning, useTriggerCrawl } from '@/hooks/useAdminOps';
import { formatDate } from '@/lib/format';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

const STATUS_COLOURS = ['#24344b', '#c47b32', '#78838b', '#d7cfbe'];
const linkButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-pill px-4 text-body-sm font-semibold transition-all duration-200 active:scale-[0.98]';

function compactDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(value)
  );
}

function humanise(value) {
  return String(value ?? 'Update')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MetricCard({ label, value, note, icon, tone = 'pine', href }) {
  const toneClasses = {
    pine: 'text-pine-700',
    lime: 'text-pine-700',
    sky: 'text-pine-700',
    lilac: 'text-pine-700',
    cream: 'text-pine-700',
    warning: 'text-amber-600',
  };
  const content = (
    <div className="admin-metric-content">
      <div>
        <p className="admin-metric-label">{label}</p>
        <p className="admin-metric-value">{value}</p>
        <p className="admin-metric-note">{note}</p>
      </div>
      <span className={`admin-metric-icon ${toneClasses[tone]}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
    </div>
  );

  return (
    <Card className={`admin-metric-card admin-metric-${tone}`}>
      {href ? (
        <Link to={href} className="block h-full" aria-label={`${label}: ${value}`}>
          {content}
        </Link>
      ) : (
        content
      )}
    </Card>
  );
}

function ChartTooltip({ active, payload, label, total }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="admin-chart-tooltip rounded-input border border-ink-100 bg-surface px-3 py-2 shadow-overlay">
      <p className="mb-2 text-caption font-semibold text-ink-900">
        {payload[0]?.payload?.fullDate ?? label}
      </p>
      {payload.map((item) => (
        <p
          key={item.dataKey}
          className="flex items-center justify-between gap-6 text-caption text-ink-700"
        >
          <span>{item.name}</span>
          <strong className="tabular-nums">{item.value.toLocaleString()}</strong>
        </p>
      ))}
      {total > 0 && (
        <p className="mt-2 border-t border-ink-100 pt-2 text-caption text-ink-500">
          {Math.round((payload[0].value / total) * 100)}% of scholarships
        </p>
      )}
    </div>
  );
}

/** Operational command centre. No student data is exposed here. */
export function AdminHome() {
  const { stats, recentAudit, loading, error, reload } = useAdminOverview();
  const { running, refresh: refreshRunning } = useCrawlRunning();
  const { trigger, pending, result, error: triggerError } = useTriggerCrawl();
  const [hoveredStatus, setHoveredStatus] = useState(null);
  const [hoveredRun, setHoveredRun] = useState(null);
  const [hiddenSeries, setHiddenSeries] = useState([]);

  if (loading) return <LoadingState rows={4} />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const lastRun = stats?.lastRun;
  const totalScholarships =
    (stats?.activeScholarships ?? 0) +
    (stats?.flaggedScholarships ?? 0) +
    (stats?.expiredScholarships ?? 0) +
    (stats?.archivedScholarships ?? 0);
  const scholarshipData = [
    { name: 'Active', value: stats?.activeScholarships ?? 0 },
    { name: 'Review', value: stats?.flaggedScholarships ?? 0 },
    { name: 'Expired', value: stats?.expiredScholarships ?? 0 },
    { name: 'Archived', value: stats?.archivedScholarships ?? 0 },
  ];
  const crawlData = [...(stats?.crawlHistory ?? [])].reverse().map((run) => ({
    date: compactDate(run.started_at),
    fullDate: run.started_at ? new Date(run.started_at).toLocaleString('en-GB') : 'Undated run',
    New: run.records_inserted ?? 0,
    Updated: run.records_updated ?? 0,
    Failed: run.records_failed ?? 0,
  }));
  const catalogTotal =
    (stats?.activeCourses ?? 0) + (stats?.activeUniversities ?? 0) + (stats?.activeCareers ?? 0);

  async function runCrawler() {
    const response = await trigger();
    if (!response.error) {
      window.setTimeout(refreshRunning, 4000);
      window.setTimeout(reload, 6000);
    }
  }

  return (
    <div className="admin-dashboard">
      <AdminPageHeader
        title="Dashboard"
        description="Scholarships, catalogue records and recent updates."
        actions={
          <>
            <Link to="/admin/scholarships" className={`${linkButton} admin-banner-primary`}>
              <Icon name="plus" className="h-4 w-4" /> Add scholarship
            </Link>
            <Button
              variant="secondary"
              onClick={runCrawler}
              loading={pending}
              disabled={Boolean(running)}
              iconLeft={<Icon name="refresh" className="h-4 w-4" />}
              className="admin-banner-secondary"
            >
              {running ? 'Crawler running' : 'Refresh data'}
            </Button>
          </>
        }
      />

      {triggerError && <Alert variant="error">{triggerError.message}</Alert>}
      {result && !running && (
        <Alert variant="success">{result.run_hint ?? 'The crawler refresh was started.'}</Alert>
      )}
      {(stats?.flaggedScholarships ?? 0) > 0 && (
        <Alert
          variant="warning"
          title={`${stats.flaggedScholarships} record${stats.flaggedScholarships === 1 ? '' : 's'} need review.`}
          className="admin-review-alert"
        >
          Check the source before publishing.{' '}
          <Link to="/admin/updates" className="font-semibold text-amber-600 underline">
            Open review queue
          </Link>
        </Alert>
      )}

      <section className="admin-overview" aria-labelledby="overview-heading">
        <div className="admin-section-heading">
          <div>
            <h2 id="overview-heading" className="text-h2 font-serif">
              At a glance
            </h2>
            <p className="mt-1 text-body-sm text-ink-500">Live operational and catalogue totals</p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="text-body-sm font-semibold text-pine-700 hover:underline"
          >
            Refresh
          </button>
        </div>
        <div className="admin-metric-grid">
          <MetricCard
            label="Scholarships"
            value={totalScholarships}
            note={`${stats?.activeScholarships ?? 0} published`}
            icon="scholarship"
            tone="lime"
            href="/admin/scholarships"
          />
          <MetricCard
            label="Needs review"
            value={stats?.flaggedScholarships ?? 0}
            note={(stats?.flaggedScholarships ?? 0) ? 'Action required' : 'Queue is clear'}
            icon="alert"
            tone={(stats?.flaggedScholarships ?? 0) ? 'warning' : 'pine'}
            href="/admin/updates"
          />
          <MetricCard
            label="Active courses"
            value={stats?.activeCourses ?? 0}
            note="In the catalogue"
            icon="book"
            tone="sky"
            href="/admin/courses"
          />
          <MetricCard
            label="Career pathways"
            value={stats?.activeCareers ?? 0}
            note="Visible to students"
            icon="career"
            tone="lilac"
            href="/admin/courses"
          />
          <MetricCard
            label="Universities"
            value={stats?.activeUniversities ?? 0}
            note="Active institutions"
            icon="database"
            tone="cream"
            href="/admin/courses"
          />
          <MetricCard
            label="Last crawler run"
            value={
              lastRun?.status === 'success'
                ? 'Healthy'
                : lastRun?.status
                  ? humanise(lastRun.status)
                  : 'Never'
            }
            note={lastRun?.started_at ? formatDate(lastRun.started_at) : 'No run recorded'}
            icon="refresh"
            tone={lastRun?.status === 'failed' ? 'warning' : 'pine'}
            href="/admin/crawler"
          />
        </div>
      </section>

      <section className="admin-operations-board" aria-label="Operations board">
        <Card
          as="article"
          className="admin-board-panel"
          aria-labelledby="scholarship-status-heading"
        >
          <div className="admin-panel-heading">
            <h2 id="scholarship-status-heading" className="text-h3 font-serif">
              Scholarship status
            </h2>
            <p className="mt-1 text-caption text-ink-500">
              Distribution across {totalScholarships} records
            </p>
          </div>
          {totalScholarships === 0 ? (
            <EmptyState
              title="No scholarship data"
              description="Add a scholarship or run the crawler to populate this chart."
            />
          ) : (
            <>
              <div className="admin-chart-frame" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={scholarshipData}
                    onMouseMove={(state) =>
                      setHoveredStatus(
                        state?.isTooltipActive ? Number(state.activeTooltipIndex) : null
                      )
                    }
                    onMouseLeave={() => setHoveredStatus(null)}
                    margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#E8E1D7" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#7A6F63', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#7A6F63', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={<ChartTooltip total={totalScholarships} />}
                      cursor={{ fill: '#EFF6F2' }}
                    />
                    <Bar
                      dataKey="value"
                      name="Records"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={44}
                      isAnimationActive={false}
                      activeBar={{ stroke: '#12332A', strokeWidth: 1 }}
                    >
                      {scholarshipData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={STATUS_COLOURS[index]}
                          fillOpacity={hoveredStatus === null || hoveredStatus === index ? 1 : 0.3}
                          style={{ transition: 'fill-opacity 120ms ease' }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="admin-status-legend grid grid-cols-2 gap-2 border-t border-ink-100 text-caption">
                {scholarshipData.map((item, index) => (
                  <li key={item.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-ink-500">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: STATUS_COLOURS[index] }}
                      />
                      {item.name}
                    </span>
                    <strong className="tabular-nums text-ink-900">{item.value}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card
          as="article"
          className="admin-board-panel"
          aria-labelledby="crawler-performance-heading"
        >
          <div className="admin-panel-heading flex items-start justify-between gap-4">
            <div>
              <h2 id="crawler-performance-heading" className="text-h3 font-serif">
                Crawler performance
              </h2>
              <p className="mt-1 text-caption text-ink-500">
                Records handled across the latest runs
              </p>
            </div>
            <Link
              to="/admin/crawler"
              className="shrink-0 text-body-sm font-semibold text-pine-700 hover:underline"
            >
              View logs
            </Link>
          </div>
          {crawlData.length === 0 ? (
            <EmptyState
              title="No crawler history"
              description="Performance appears here after the first crawler run."
            />
          ) : (
            <>
              <div className="admin-chart-frame" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={crawlData}
                    margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
                    onMouseMove={(state) =>
                      setHoveredRun(
                        state?.isTooltipActive ? Number(state.activeTooltipIndex) : null
                      )
                    }
                    onMouseLeave={() => setHoveredRun(null)}
                  >
                    <CartesianGrid stroke="#E8E1D7" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#7A6F63', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#7A6F63', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#EFF6F2' }} />
                    {[
                      ['New', '#2F6A55'],
                      ['Updated', '#8BAA78'],
                      ['Failed', '#A33A22'],
                    ].map(([name, colour]) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        fill={colour}
                        hide={hiddenSeries.includes(name)}
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                        activeBar={{ stroke: '#12332A', strokeWidth: 1 }}
                      >
                        {crawlData.map((run, index) => (
                          <Cell
                            key={index}
                            fillOpacity={hoveredRun === null || hoveredRun === index ? 1 : 0.25}
                            style={{ transition: 'fill-opacity 120ms ease' }}
                          />
                        ))}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div
                className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3"
                aria-label="Visible crawler series"
              >
                {['New', 'Updated', 'Failed'].map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={!hiddenSeries.includes(name)}
                    onClick={() =>
                      setHiddenSeries((current) =>
                        current.includes(name)
                          ? current.filter((item) => item !== name)
                          : [...current, name]
                      )
                    }
                    className={`flex min-h-9 items-center gap-2 rounded px-2 text-caption hover:bg-paper ${hiddenSeries.includes(name) ? 'text-ink-500 line-through' : 'text-ink-900'}`}
                  >
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{
                        background: ['#2F6A55', '#8BAA78', '#A33A22'][index],
                        opacity: hiddenSeries.includes(name) ? 0.3 : 1,
                      }}
                    />
                    {name}
                  </button>
                ))}
                <span className="text-caption text-ink-500">Click to show or hide</span>
              </div>
              <p className="sr-only">
                Latest crawler runs are also available as a data table on the crawler logs page.
              </p>
            </>
          )}
        </Card>
        <Card
          as="article"
          className="admin-board-panel admin-activity-panel"
          aria-labelledby="recent-activity-heading"
        >
          <div className="admin-panel-heading flex items-center justify-between border-b border-ink-100">
            <div>
              <h2 id="recent-activity-heading" className="text-h3 font-serif">
                Recent activity
              </h2>
              <p className="mt-1 text-caption text-ink-500">Latest administrator changes</p>
            </div>
            <Link
              to="/admin/audit"
              className="text-body-sm font-semibold text-pine-700 hover:underline"
            >
              View all
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Catalogue edits will appear here automatically."
            />
          ) : (
            <div
              className="admin-activity-table-wrap overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Recent activity records"
            >
              <table className="w-full border-collapse text-body-sm">
                <caption className="sr-only">Recent administrator activity</caption>
                <thead className="bg-pine-50">
                  <tr className="text-left text-caption uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-3 font-medium md:px-6">Activity</th>
                    <th className="px-5 py-3 font-medium">Area</th>
                    <th className="px-5 py-3 text-right font-medium md:px-6">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {recentAudit.map((entry) => (
                    <tr key={entry.id} className="transition-colors hover:bg-paper">
                      <td className="px-5 py-3.5 md:px-6">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium text-ink-900">{humanise(entry.action)}</p>
                            <p className="text-caption text-ink-500">
                              {entry.metadata?.name ?? entry.metadata?.label ?? 'System record'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge>{humanise(entry.target_table ?? 'system')}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums text-ink-500 md:px-6">
                        {formatDate(entry.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <Card as="nav" className="admin-quick-access" aria-labelledby="quick-access-heading">
        <div className="admin-quick-heading">
          <h2 id="quick-access-heading" className="text-h3 font-serif">
            Quick access
          </h2>
          <p className="mt-1 text-caption text-ink-500">Common management tasks</p>
        </div>
        <div className="admin-quick-links">
          {[
            {
              to: '/admin/scholarships',
              icon: 'scholarship',
              title: 'Manage scholarships',
              note: 'Create, edit and publish',
            },
            {
              to: '/admin/courses',
              icon: 'database',
              title: 'Manage catalogue',
              note: `${catalogTotal} active records`,
            },
            {
              to: '/admin/updates',
              icon: 'alert',
              title: 'Review updates',
              note: `${stats?.flaggedScholarships ?? 0} waiting`,
            },
            {
              to: '/admin/crawler',
              icon: 'refresh',
              title: 'Crawler history',
              note: 'Runs, failures and duration',
            },
            {
              to: '/admin/audit',
              icon: 'shield',
              title: 'Audit trail',
              note: 'Review administrator changes',
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="admin-quick-link group flex items-center gap-3"
            >
              <span className="shrink-0 text-pine-700">
                <Icon name={item.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-900">{item.title}</span>
                <span className="block text-caption text-ink-500">{item.note}</span>
              </span>
              <Icon
                name="arrowRight"
                className="h-4 w-4 text-ink-300 transition-transform group-hover:translate-x-1 group-hover:text-pine-700"
              />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default AdminHome;
