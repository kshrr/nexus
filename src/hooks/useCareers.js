import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';
import { careerStudyLinks } from '@/data/careerStudyLinks';

const COURSE_SELECT =
  'id, name, field_of_study, pathway_type, duration_months, entry_requirements, required_subject_codes, universities(name)';
const SCHOLARSHIP_SELECT =
  'id, name, provider, description, funding_amount, field_of_study, education_levels, deadline, status';
// Which study level a student at each education level is most likely to apply for next.
const NEXT_PATHWAYS = {
  spm: ['foundation', 'diploma', 'degree'],
  stpm: ['degree', 'diploma', 'foundation'],
  matriculation: ['degree', 'diploma', 'foundation'],
  foundation: ['degree', 'diploma', 'foundation'],
  diploma: ['degree', 'diploma', 'foundation'],
  degree: ['degree', 'diploma', 'foundation'],
};

export function rankCourses(courses, educationLevel) {
  const order = NEXT_PATHWAYS[educationLevel] ?? ['degree', 'diploma', 'foundation'];
  const rank = (course) => {
    const i = order.indexOf(course.pathway_type);
    return i === -1 ? order.length : i;
  };
  const seen = new Set();
  return courses
    .filter((course) => !seen.has(course.id) && seen.add(course.id))
    .map((course) => ({ ...course, university_name: course.universities?.name ?? null }))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

// Field-specific scholarships first, then ones open to any field; both keep only
// those that accept the student's current education level (an empty list means all).
export function rankScholarships(fieldMatches, openToAll, educationLevel) {
  const fits = (item) =>
    !educationLevel ||
    !item.education_levels?.length ||
    item.education_levels.includes(educationLevel);
  const seen = new Set();
  return [
    ...fieldMatches.map((item) => ({ ...item, openToAllFields: false })),
    ...openToAll.map((item) => ({ ...item, openToAllFields: true })),
  ].filter((item) => fits(item) && !seen.has(item.id) && seen.add(item.id));
}

const CAREER_SELECT =
  'id, name, slug, field, description, responsibilities, required_skills, useful_subjects, education_routes, riasec_profile, reference_occupations, content_review, is_active';
function careerLoadError(error) {
  const result = normaliseError(error);
  return ['42703', 'PGRST204'].includes(result.code)
    ? {
        code: 'CAREER_CONTENT_UNAVAILABLE',
        message:
          'Career content update unavailable. The source-backed content migration must be applied before these pages can load.',
      }
    : result;
}

export function useCareers({ search = '', category = 'All' } = {}) {
  const request = useRef(0);
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const version = ++request.current;
    setCareers([]);
    if (!config.isConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('careers')
        .select(CAREER_SELECT)
        .eq('is_active', true)
        .order('name');
      if (category !== 'All') query = query.eq('field', category);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`name.ilike.${term},field.ilike.${term},description.ilike.${term}`);
      }
      const { data, error: queryError } = await query;
      if (version !== request.current) return;
      if (queryError) throw queryError;
      setCareers(data ?? []);
    } catch (err) {
      if (version === request.current) setError(careerLoadError(err));
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    load();
    return () => {
      request.current += 1;
    };
  }, [load]);

  return { careers, loading, error, reload: load };
}

export function useCareer(idOrSlug, educationLevel) {
  const request = useRef(0);
  const key = JSON.stringify([idOrSlug, educationLevel]);
  const [loadedFor, setLoadedFor] = useState('');
  const [career, setCareer] = useState(null);
  const [courses, setCourses] = useState([]);
  const [scholarships, setScholarships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const version = ++request.current;
    setCareer(null);
    setCourses([]);
    setScholarships([]);
    setError(null);
    if (!config.isConfigured || !idOrSlug) {
      setLoading(false);
      setLoadedFor(key);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(idOrSlug);
      let careerQuery = supabase.from('careers').select(CAREER_SELECT).eq('is_active', true);
      careerQuery = isUuid ? careerQuery.eq('id', idOrSlug) : careerQuery.eq('slug', idOrSlug);
      const { data: careerRow, error: careerError } = await careerQuery.maybeSingle();
      if (version !== request.current) return;
      if (careerError) throw careerError;
      if (!careerRow) {
        setCareer(null);
        setCourses([]);
        setScholarships([]);
        return;
      }

      // The education route map comes from src/data/careerRoutes.js. Courses come
      // from hand-made career_courses links plus name matches in the scraped
      // catalogue; scholarships are matched by study field.
      const links = careerStudyLinks(careerRow.slug);
      const [mappingResult, matchResult] = await Promise.all([
        supabase.from('career_courses').select('course_id').eq('career_id', careerRow.id),
        links.courseTerms.length
          ? supabase
              .from('courses')
              .select(COURSE_SELECT)
              .eq('is_active', true)
              .or(links.courseTerms.map((term) => `name.ilike.%${term}%`).join(','))
              .order('name')
              .limit(200)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (version !== request.current) return;
      if (mappingResult.error) throw mappingResult.error;
      if (matchResult.error) throw matchResult.error;

      const courseIds = (mappingResult.data ?? []).map((row) => row.course_id);
      let linkedCourses = [];
      if (courseIds.length) {
        const courseResult = await supabase
          .from('courses')
          .select(COURSE_SELECT)
          .in('id', courseIds)
          .eq('is_active', true)
          .order('name');
        if (courseResult.error) throw courseResult.error;
        if (version !== request.current) return;
        linkedCourses = courseResult.data ?? [];
      }
      const matchedCourses = (matchResult.data ?? []).filter(
        (course) =>
          course.pathway_type === 'foundation' || links.studyFields.includes(course.field_of_study)
      );
      setCourses(rankCourses([...linkedCourses, ...matchedCourses], educationLevel));

      const fields = links.studyFields.length
        ? links.studyFields
        : [...new Set(linkedCourses.map((course) => course.field_of_study).filter(Boolean))];
      const scholarshipQuery = () =>
        supabase
          .from('scholarships')
          .select(SCHOLARSHIP_SELECT)
          .eq('status', 'active')
          .order('deadline', { ascending: true, nullsFirst: false })
          .limit(20);
      const [fieldResult, openResult] = await Promise.all([
        fields.length
          ? scholarshipQuery().overlaps('field_of_study', fields)
          : Promise.resolve({ data: [], error: null }),
        scholarshipQuery().eq('field_of_study', '{}'),
      ]);
      if (version !== request.current) return;
      if (fieldResult.error) throw fieldResult.error;
      if (openResult.error) throw openResult.error;
      setScholarships(
        rankScholarships(fieldResult.data ?? [], openResult.data ?? [], educationLevel)
      );
      setCareer(careerRow);
    } catch (err) {
      if (version === request.current) {
        setCareer(null);
        setCourses([]);
        setScholarships([]);
        setError(careerLoadError(err));
      }
    } finally {
      if (version === request.current) {
        setLoadedFor(key);
        setLoading(false);
      }
    }
  }, [idOrSlug, educationLevel, key]);

  useEffect(() => {
    load();
    return () => {
      request.current += 1;
    };
  }, [load]);

  const courseFields = useMemo(
    () => [...new Set(courses.map((course) => course.field_of_study).filter(Boolean))],
    [courses]
  );

  const current = loadedFor === key;
  return {
    career: current ? career : null,
    courses: current ? courses : [],
    courseFields: current ? courseFields : [],
    scholarships: current ? scholarships : [],
    loading: !current || loading,
    error: current ? error : null,
    reload: load,
  };
}
