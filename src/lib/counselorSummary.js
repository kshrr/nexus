import { jsPDF } from 'jspdf';
import { formatDate, pointsToGrade, strengthLabel } from './format.js';
import { EXAM_TYPES, EXAM_TYPE_LABELS, GRADE_POINTS } from '../types/index.js';

const DIMENSIONS = [
  ['Realistic', 'realistic_score'],
  ['Investigative', 'investigative_score'],
  ['Artistic', 'artistic_score'],
  ['Social', 'social_score'],
  ['Enterprising', 'enterprising_score'],
  ['Conventional', 'conventional_score'],
];

const COLORS = {
  pine: [31, 68, 56],
  mint: [226, 239, 229],
  paper: [250, 248, 242],
  ink: [36, 52, 75],
  muted: [88, 102, 105],
  rule: [209, 221, 211],
  strong: [37, 111, 76],
  average: [165, 103, 31],
  weak: [162, 67, 52],
};
const BAND_COLORS = {
  strong: COLORS.strong,
  average: COLORS.average,
  weak: COLORS.weak,
};
const TREND_COLORS = [
  [31, 68, 56],
  [69, 123, 92],
  [148, 104, 41],
  [172, 65, 50],
  [75, 90, 115],
  [119, 89, 129],
];

function drawRouteIllustration(pdf, x, y) {
  pdf.setDrawColor(174, 214, 188);
  pdf.setLineWidth(1.1);
  pdf.line(x, y, x + 44, y);
  for (const [offset, radius] of [
    [0, 2.2],
    [19, 2.2],
    [44, 3.7],
  ]) {
    pdf.setFillColor(...(offset === 44 ? COLORS.paper : COLORS.pine));
    pdf.circle(x + offset, y, radius, 'FD');
  }
  pdf.setDrawColor(115, 174, 138);
  pdf.circle(x + 44, y, 7.5, 'S');
  pdf.line(x + 44, y - 10, x + 44, y - 7.5);
  pdf.line(x + 44, y + 7.5, x + 44, y + 10);
}

function drawRadarPanel(pdf, x, y, width, riasec) {
  pdf.setFillColor(...COLORS.paper);
  pdf.roundedRect(x, y, width, 76, 3, 3, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.pine);
  pdf.text('RIASEC interest map', x + 7, y + 10);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.muted);
  pdf.text('Each dimension is scored out of 24', x + 84, y + 16);

  const scores = DIMENSIONS.map(([, key]) => Number(riasec?.[key]));
  const complete = DIMENSIONS.every(
    ([, key], i) => riasec?.[key] != null && Number.isFinite(scores[i])
  );
  if (complete) {
    const cx = x + 42;
    const cy = y + 45;
    const radius = 23;
    const angle = (index) => -Math.PI / 2 + (index * Math.PI) / 3;
    const point = (index, distance) => [
      cx + Math.cos(angle(index)) * distance,
      cy + Math.sin(angle(index)) * distance,
    ];
    pdf.setLineWidth(0.25);
    pdf.setDrawColor(...COLORS.rule);
    for (const fraction of [0.25, 0.5, 0.75, 1]) {
      for (let i = 0; i < 6; i += 1) {
        pdf.line(...point(i, radius * fraction), ...point((i + 1) % 6, radius * fraction));
      }
    }
    for (let i = 0; i < 6; i += 1) pdf.line(cx, cy, ...point(i, radius));

    const vertices = scores.map((score, index) =>
      point(index, (radius * Math.max(0, Math.min(24, score))) / 24)
    );
    pdf.setFillColor(183, 217, 191);
    for (let i = 0; i < 6; i += 1) {
      pdf.triangle(cx, cy, ...vertices[i], ...vertices[(i + 1) % 6], 'F');
    }
    pdf.setDrawColor(...COLORS.pine);
    pdf.setFillColor(...COLORS.pine);
    pdf.setLineWidth(0.75);
    for (let i = 0; i < 6; i += 1) {
      pdf.line(...vertices[i], ...vertices[(i + 1) % 6]);
      pdf.circle(...vertices[i], 0.9, 'F');
      const [lx, ly] = point(i, radius + 6);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.pine);
      pdf.text('RIASEC'[i], lx, ly + 1.5, { align: 'center' });
    }
  } else {
    pdf.text('Complete score set unavailable', x + 9, y + 45);
  }

  DIMENSIONS.forEach(([name, key], index) => {
    const score = riasec?.[key];
    const rowY = y + 24 + index * 7.5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...COLORS.ink);
    pdf.text(`${name}: ${score == null ? 'n/a' : `${score}/24`}`, x + 84, rowY);
    if (score != null && Number.isFinite(Number(score))) {
      pdf.setFillColor(...COLORS.rule);
      pdf.roundedRect(x + 84, rowY + 1.6, 67, 1.8, 0.9, 0.9, 'F');
      pdf.setFillColor(...COLORS.strong);
      pdf.roundedRect(
        x + 84,
        rowY + 1.6,
        (67 * Math.max(0, Math.min(24, Number(score)))) / 24,
        1.8,
        0.9,
        0.9,
        'F'
      );
    }
  });
}

function academicSeries(academicGrades, subjects) {
  const names = new Map(subjects.map((subject) => [subject.code, subject.name]));
  return Object.entries(academicGrades)
    .map(([code, grades]) => ({
      name: names.get(code) ?? code,
      grades: EXAM_TYPES.map((exam) => grades?.[exam] ?? null),
      points: EXAM_TYPES.map((exam) =>
        grades?.[exam] in GRADE_POINTS ? GRADE_POINTS[grades[exam]] : null
      ),
    }))
    .filter((series) => series.points.some((point) => point != null))
    .slice(0, 6);
}

function drawTrendPanel(pdf, x, y, width, series) {
  pdf.setFillColor(...COLORS.paper);
  pdf.roundedRect(x, y, width, series.length <= 3 ? 85 : 94, 3, 3, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.pine);
  pdf.text('Academic progress across exams', x + 7, y + 10);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.muted);
  pdf.text('Saved grades shown as points, from G (0) to A+ (9)', x + 7, y + 16);

  const left = x + 24;
  const right = x + width - 13;
  const top = y + 22;
  const bottom = y + 67;
  const xAt = (index) => left + ((right - left) * index) / 2;
  const yAt = (points) => bottom - ((bottom - top) * points) / 9;
  pdf.setLineWidth(0.25);
  for (const tick of [0, 3, 6, 9]) {
    pdf.setDrawColor(...COLORS.rule);
    pdf.line(left, yAt(tick), right, yAt(tick));
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(pointsToGrade(tick), left - 5, yAt(tick) + 1.8, { align: 'right' });
  }
  pdf.setDrawColor(185, 166, 129);
  pdf.setLineDashPattern([1.7, 1.4], 0);
  pdf.line(left, yAt(7), right, yAt(7));
  pdf.setLineDashPattern([], 0);
  pdf.setFontSize(7);
  pdf.text('Strong threshold', right, yAt(7) - 1.5, { align: 'right' });

  EXAM_TYPES.forEach((exam, index) => {
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(EXAM_TYPE_LABELS[exam], xAt(index), bottom + 6, { align: 'center' });
  });
  series.forEach((row, index) => {
    const color = TREND_COLORS[index];
    pdf.setDrawColor(...color);
    pdf.setFillColor(...color);
    pdf.setLineWidth(0.8);
    let previous = null;
    row.points.forEach((point, examIndex) => {
      if (point == null) return;
      const current = [xAt(examIndex), yAt(point)];
      if (previous) pdf.line(...previous, ...current);
      pdf.circle(...current, 1.1, 'F');
      previous = current;
    });
    const legendX = x + 8 + (index % 3) * 54;
    const legendY = y + 81 + Math.floor(index / 3) * 7;
    pdf.setFillColor(...color);
    pdf.circle(legendX, legendY - 1, 1.1, 'F');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.ink);
    pdf.text(pdf.splitTextToSize(row.name, 47)[0], legendX + 3, legendY);
  });
}

/** Build the student's shareable summary from the same records shown on the page. */
export function createCounselorSummaryPdf({
  profile,
  riasec,
  strengths = [],
  careers = [],
  secondaryCareers = [],
  courses = [],
  academicGrades = {},
  subjects = [],
  academicResultsUnavailable = false,
  generatedAt,
  now = new Date(),
}) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 19;
  const usable = width - margin * 2;
  let y = 20;

  const ensureSpace = (space) => {
    if (y + space <= height - 20) return;
    pdf.addPage();
    y = 22;
  };
  const line = (value, { bold = false, size = 10, gap = 2, indent = 0 } = {}) => {
    if (value == null || value === '') return;
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(bold ? 29 : 58, bold ? 58 : 69, bold ? 48 : 73);
    const lines = pdf.splitTextToSize(String(value), usable - indent);
    const lineHeight = size * 0.48;
    for (const text of lines) {
      ensureSpace(lineHeight);
      pdf.text(text, margin + indent, y);
      y += lineHeight;
    }
    y += gap;
  };
  const section = (title) => {
    ensureSpace(17);
    y += 4;
    pdf.setDrawColor(174, 193, 180);
    pdf.line(margin, y, width - margin, y);
    y += 7;
    line(title, { bold: true, size: 13, gap: 3 });
  };
  const recommendation = (row, kind) => {
    const detail = row.detail;
    if (!detail) return;
    ensureSpace(18);
    const score =
      kind === 'Interest overlap' || row.match_score == null
        ? ''
        : Number.isFinite(Number(row.match_score))
          ? ` - ${Math.round(Number(row.match_score))}% match`
          : '';
    line(`${detail.name}${score}`, { bold: true, size: 10, gap: 1 });
    const context =
      kind === 'Course'
        ? [detail.university_name, detail.pathway_type]
        : [detail.field, kind === 'Interest overlap' ? 'Exploratory interest overlap' : null];
    const meta = context.filter(Boolean).join(' | ');
    if (meta) line(meta, { size: 9, gap: 1, indent: 3 });
    if (kind === 'Interest overlap') {
      line(
        `Shared Holland Code letters: ${(row.shared_letters ?? []).join(', ') || 'not provided'}. This is an exploratory interest link, not an academic rule.`,
        { size: 9, gap: 1, indent: 3 }
      );
    } else {
      for (const reason of row.reasons ?? []) {
        if (reason.text)
          line(`${reason.satisfied ? 'Met' : 'To review'}: ${reason.text}`, {
            size: 9,
            gap: 1,
            indent: 3,
          });
      }
    }
    if (kind === 'Course' && detail.entry_requirements) {
      line(`Entry requirements: ${detail.entry_requirements}`, { size: 9, gap: 1, indent: 3 });
    }
    y += 2;
  };

  pdf.setFillColor(...COLORS.pine);
  pdf.rect(0, 0, width, 38, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(199, 229, 207);
  pdf.text('NEXUS  /  FIND YOUR PATH', margin, 14);
  pdf.setFontSize(21);
  pdf.setTextColor(255, 255, 255);
  pdf.text('Counselor conversation brief', margin, 29);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(225, 241, 229);
  pdf.text('Your interests, school results and pathways in one place', margin, 36);
  drawRouteIllustration(pdf, width - 69, 14);
  y = 48;

  pdf.setFillColor(...COLORS.paper);
  pdf.roundedRect(margin, y, usable, 18, 3, 3, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...COLORS.ink);
  pdf.text(profile?.full_name?.trim() || 'Name not provided', margin + 6, y + 8);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(`Prepared ${formatDate(now)}`, margin + 6, y + 14);
  if (generatedAt)
    pdf.text(`Matches updated ${formatDate(generatedAt)}`, width - margin - 6, y + 14, {
      align: 'right',
    });
  y += 22;

  section('Interest assessment results');
  line(`Holland Code: ${riasec?.holland_code || 'Not available'}`, { bold: true });
  if (riasec?.completed_at)
    line(`Assessment completed: ${formatDate(riasec.completed_at)}`, { size: 9 });
  ensureSpace(79);
  drawRadarPanel(pdf, margin, y, usable, riasec);
  y += 80;

  section('Academic subject strengths');
  if (strengths.length) {
    ensureSpace(34);
    const bands = [
      ['Strong', 'strong'],
      ['Average', 'average'],
      ['Weak', 'weak'],
    ];
    bands.forEach(([label, band], index) => {
      const cardWidth = (usable - 10) / 3;
      const cardX = margin + index * (cardWidth + 5);
      pdf.setFillColor(...COLORS.paper);
      pdf.roundedRect(cardX, y, cardWidth, 21, 2.5, 2.5, 'F');
      pdf.setFillColor(...BAND_COLORS[band]);
      pdf.roundedRect(cardX, y, 2.5, 21, 1.2, 1.2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...BAND_COLORS[band]);
      pdf.text(
        `${label} (${strengths.filter((s) => s.strength === band).length})`,
        cardX + 6,
        y + 10
      );
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(
        label === 'Strong' ? 'A- and above' : label === 'Average' ? 'C+ to B+' : 'Below C+',
        cardX + 6,
        y + 18
      );
    });
    y += 25;
    line('Subject averages from recorded exams (0 = G, 9 = A+)', { size: 8.5, gap: 3 });
    for (const subject of strengths) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      const nameLines = pdf.splitTextToSize(subject.name, 80);
      const rowHeight = 10 + Math.max(0, nameLines.length - 1) * 4;
      ensureSpace(rowHeight + 1);
      const color = BAND_COLORS[subject.strength] ?? COLORS.muted;
      const grade = subject.averagePoints == null ? 'n/a' : pointsToGrade(subject.averagePoints);
      const count = subject.examCount
        ? ` | ${subject.examCount} exam${subject.examCount === 1 ? '' : 's'}`
        : '';
      pdf.setTextColor(...COLORS.ink);
      nameLines.forEach((nameLine, index) => pdf.text(nameLine, margin + 2, y + index * 4));
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...color);
      pdf.text(`${strengthLabel(subject.strength)} | ${grade}${count}`, width - margin - 2, y, {
        align: 'right',
      });
      pdf.setFillColor(...COLORS.rule);
      const barY = y + 2.3 + (nameLines.length - 1) * 4;
      pdf.roundedRect(margin + 2, barY, usable - 4, 2.2, 1.1, 1.1, 'F');
      if (subject.averagePoints != null && Number.isFinite(Number(subject.averagePoints))) {
        pdf.setFillColor(...color);
        pdf.roundedRect(
          margin + 2,
          barY,
          ((usable - 4) * Math.max(0, Math.min(9, Number(subject.averagePoints)))) / 9,
          2.2,
          1.1,
          1.1,
          'F'
        );
      }
      y += rowHeight;
    }
  } else {
    line('No subject results available. Career and course matches may rely on interests only.', {
      size: 9,
    });
  }

  const series = academicSeries(academicGrades, subjects);
  if (series.length) {
    ensureSpace(series.length <= 3 ? 116 : 125);
    section('Your journey across exams');
    drawTrendPanel(pdf, margin, y, usable, series);
    y += series.length <= 3 ? 90 : 99;
    line('Saved grades: Form 4 Final | SPM Trial | SPM Actual', { size: 8.5, gap: 2 });
    for (const row of series)
      line(`${row.name}: ${row.grades.map((grade) => grade ?? '-').join(' | ')}`, {
        size: 8.5,
        gap: 1,
        indent: 3,
      });
    if (Object.keys(academicGrades).length > series.length) {
      line('The graph shows up to six subjects, matching the academic analysis page.', { size: 8 });
    }
  } else {
    section('Your journey across exams');
    line(
      academicResultsUnavailable
        ? 'Saved exam grades could not be loaded for this summary.'
        : 'No saved exam grades to plot yet.',
      { size: 9 }
    );
  }

  section('Career recommendations');
  const listedCareers = [
    ...careers.filter((row) => row.detail),
    ...secondaryCareers.filter((row) => row.detail),
  ];
  if (!listedCareers.length) line('No career recommendations available.', { size: 9 });
  careers.forEach((row) => recommendation(row, 'Career'));
  secondaryCareers.forEach((row) => recommendation(row, 'Interest overlap'));

  section('Course recommendations');
  if (!courses.some((row) => row.detail)) line('No course recommendations available.', { size: 9 });
  courses.forEach((row) => recommendation(row, 'Course'));

  section('What to discuss next');
  line(
    'Discuss how your interests and grades relate to these pathways, and confirm entry requirements with each institution. These suggestions do not guarantee admission or funding. Scholarship matches are checked live in Nexus and are not part of this PDF.',
    { size: 9 }
  );

  const pages = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    if (page > 1) {
      pdf.setFillColor(...COLORS.pine);
      pdf.rect(0, 0, width, 6, 'F');
    }
    pdf.setDrawColor(204, 215, 207);
    pdf.line(margin, height - 16, width - margin, height - 16);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 108, 103);
    pdf.text('Nexus Find Your Path', margin, height - 11);
    pdf.text(`${page} / ${pages}`, width - margin, height - 11, { align: 'right' });
  }
  return pdf;
}
