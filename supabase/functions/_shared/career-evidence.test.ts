import { describe, expect, it } from 'vitest';
import { reviewedCareer, reviewedStage } from '../../../src/test/fixtures/careerEvidence.js';
import {
  isValidInterestCode,
  normaliseCareerEvidence,
  getSectionReview,
  getBestInterestReference,
  normaliseStageReview,
} from './career-evidence';

describe('sourced career evidence', () => {
  it('rejects coerced JSON types for source URLs and review enums', () => {
    const c = reviewedCareer();
    c.content_review.sections.interests.sources[0].url = [
      c.content_review.sections.interests.sources[0].url,
    ];
    expect(normaliseCareerEvidence(c).status).toBe('pending');
    expect(getBestInterestReference(c, 'ICS')).toBeNull();
    expect(normaliseStageReview({ ...reviewedStage(), status: ['source_checked'] })).toBeNull();
    expect(normaliseStageReview({ ...reviewedStage(), kind: ['source_informed'] })).toBeNull();
    const parent = reviewedCareer();
    parent.content_review.status = ['source_checked'];
    expect(normaliseCareerEvidence(parent).status).toBe('pending');
    const ref = reviewedCareer();
    ref.reference_occupations[0].mapping_kind = ['related'];
    expect(normaliseCareerEvidence(ref).status).toBe('pending');
  });
  it.each(['S', 'CI', 'IC', 'RIASEC'])('accepts genuine %s codes', (code) =>
    expect(isValidInterestCode(code)).toBe(true)
  );
  it.each(['', 'II', 'ic', 'IC ', 'X', null, 123])('rejects invalid code %s', (code) =>
    expect(isValidInterestCode(code)).toBe(false)
  );
  it('publishes reviewed scoped sections without padding one-letter codes', () => {
    const c = reviewedCareer({ code: 'S' });
    expect(normaliseCareerEvidence(c).references[0]?.interest_code).toBe('S');
    expect(getSectionReview(c, 'overview')?.sources[0].publisher).toBe('O*NET OnLine');
    expect(getBestInterestReference(c, 'ISA')?.sharedLetters).toEqual(['S']);
  });
  it('requires both letters for IC and supports actual partial explanatory overlap', () => {
    expect(getBestInterestReference(reviewedCareer(), 'IAE')).toBeNull();
    expect(
      getBestInterestReference(reviewedCareer(), 'IAE', { requireThreshold: false })?.sharedLetters
    ).toEqual(['I']);
    expect(getBestInterestReference(reviewedCareer(), 'CIS')?.sharedLetters).toEqual(['I', 'C']);
  });
  it('does not combine letters from separate profiles', () => {
    const c = reviewedCareer();
    c.reference_occupations.push({
      ...c.reference_occupations[0],
      reference_id: '27-1014.00',
      interest_code: 'AR',
    });
    expect(getBestInterestReference(c, 'IAE')).toBeNull();
  });
  it('uses reference ID as stable tie-breaker', () => {
    const c = reviewedCareer();
    c.reference_occupations.push({
      ...c.reference_occupations[0],
      reference_id: '01-example',
      interest_code: 'CI',
    });
    expect(getBestInterestReference(c, 'CIS')?.reference.reference_id).toBe('01-example');
  });
  it('pending parent metadata cannot reuse a previously checked section', () => {
    const c = reviewedCareer();
    c.content_review.status = 'pending';
    expect(getSectionReview(c, 'overview')).toBeNull();
    expect(getBestInterestReference(c, 'ICS')).toBeNull();
  });
  it.each(['javascript:alert(1)', 'https://user:secret@example.com', 'http://example.com'])(
    'blocks unsafe sources %s',
    (url) => {
      const c = reviewedCareer();
      c.content_review.sections.interests = {
        ...reviewedStage(),
        sources: [{ ...reviewedStage().sources[0], url }],
      };
      expect(getBestInterestReference(c, 'ICS')).toBeNull();
      expect(normaliseCareerEvidence(c).status).toBe('pending');
    }
  );
  it('blocks invalid calendar dates and cross-section source references', () => {
    const c = reviewedCareer();
    c.content_review.sections.interests.checked_on = '2026-02-30';
    expect(getBestInterestReference(c, 'ICS')).toBeNull();
    const d = reviewedCareer();
    d.reference_occupations[0].interest_source_id = 'missing';
    expect(getBestInterestReference(d, 'ICS')).toBeNull();
  });
  it('blocks duplicate references and malformed evidence arrays', () => {
    const c = reviewedCareer();
    c.reference_occupations.push(c.reference_occupations[0]);
    expect(normaliseCareerEvidence(c).status).toBe('pending');
    expect(normaliseCareerEvidence({ content_review: [] }).references).toEqual([]);
  });
  it('keeps independently checked interests when the overall route has a limitation', () => {
    const c = reviewedCareer();
    c.content_review.status = 'limited';
    c.content_review.limitations = ['Registration mapping unavailable'];
    expect(getBestInterestReference(c, 'ICS')?.sharedLetters).toEqual(['I', 'C']);
  });
  it('normalises stage evidence and rejects pending or malformed stages', () => {
    expect(normaliseStageReview(reviewedStage())?.status).toBe('source_checked');
    expect(normaliseStageReview({ status: 'pending' })).toBeNull();
    expect(normaliseStageReview({ ...reviewedStage(), checked_on: 'bad' })).toBeNull();
  });
});
