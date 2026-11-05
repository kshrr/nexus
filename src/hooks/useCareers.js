import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';
import { EDUCATION_LEVELS } from '@/types';

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
  const [stages, setStages] = useState([]);
  const [courses, setCourses] = useState([]);
  const [scholarships, setScholarships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const version = ++request.current;
    setCareer(null);
    setStages([]);
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
        setStages([]);
        setCourses([]);
        setScholarships([]);
        return;
      }

      const level = EDUCATION_LEVELS.includes(educationLevel) ? educationLevel : null;
      const [stageResult, mappingResult] = await Promise.all([
        level
          ? supabase
              .from('career_pathway_stages')
              .select(
                'id, stage_order, stage_title, stage_description, focus_points, content_review'
              )
              .eq('career_id', careerRow.id)
              .eq('from_education_level', level)
              .order('stage_order')
          : Promise.resolve({ data: [], error: null }),
        supabase.from('career_courses').select('course_id').eq('career_id', careerRow.id),
      ]);
      if (version !== request.current) return;
      if (stageResult.error) throw stageResult.error;
      if (mappingResult.error) throw mappingResult.error;
      setStages(stageResult.data ?? []);

      const courseIds = (mappingResult.data ?? []).map((row) => row.course_id);
      let relatedCourses = [];
      if (courseIds.length) {
        const courseResult = await supabase
          .from('courses')
          .select(
            'id, name, field_of_study, pathway_type, duration_months, entry_requirements, required_subject_codes, universities(name)'
          )
          .in('id', courseIds)
          .eq('is_active', true)
          .order('name');
        if (courseResult.error) throw courseResult.error;
        if (version !== request.current) return;
        relatedCourses = (courseResult.data ?? []).map((course) => ({
          ...course,
          university_name: course.universities?.name ?? null,
        }));
      }
      setCourses(relatedCourses);

      const fields = [
        ...new Set(relatedCourses.map((course) => course.field_of_study).filter(Boolean)),
      ];
      if (!fields.length) {
        setScholarships([]);
      } else {
        let scholarshipQuery = supabase
          .from('scholarships')
          .select(
            'id, name, provider, description, funding_amount, field_of_study, education_levels, deadline, status'
          )
          .eq('status', 'active')
          .overlaps('field_of_study', fields)
          .order('deadline', { ascending: true, nullsFirst: false })
          .limit(4);
        if (educationLevel) {
          // Keep broad scholarships visible; filter the final rows so records
          // with an empty level list still behave as "all levels".
          const response = await scholarshipQuery;
          if (version !== request.current) return;
          if (response.error) throw response.error;
          setScholarships(
            (response.data ?? []).filter(
              (item) =>
                !item.education_levels?.length || item.education_levels.includes(educationLevel)
            )
          );
        } else {
          const response = await scholarshipQuery;
          if (version !== request.current) return;
          if (response.error) throw response.error;
          setScholarships(response.data ?? []);
        }
      }
      setCareer(careerRow);
    } catch (err) {
      if (version === request.current) {
        setCareer(null);
        setStages([]);
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
    stages: current ? stages : [],
    courses: current ? courses : [],
    courseFields: current ? courseFields : [],
    scholarships: current ? scholarships : [],
    loading: !current || loading,
    error: current ? error : null,
    reload: load,
  };
}
