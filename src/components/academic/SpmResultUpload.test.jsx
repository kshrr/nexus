import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpmResultUpload } from './SpmResultUpload';
import { mergeDetectedGrades } from '@/lib/gradeMerge';

const SUBJECTS = [
  { code: 'BM', name: 'Bahasa Melayu' },
  { code: 'MATH', name: 'Mathematics' },
];
const photo = (type = 'image/jpeg', size = 1000) => {
  const file = new File(['x'], 'slip.jpg', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};
const choose = (file) =>
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });

describe('SpmResultUpload', () => {
  it('reads the photo on the device and hands the found grades on', async () => {
    const recognise = vi.fn(async (_file, onProgress) => {
      onProgress(0.5);
      return '1103 BAHASA MELAYU A+ CEMERLANG TERTINGGI\n1449 MATEMATIK B KEPUJIAN TINGGI\nSEJARAH ??';
    });
    const onDetected = vi.fn();
    render(<SpmResultUpload subjects={SUBJECTS} onDetected={onDetected} recognise={recognise} />);
    expect(screen.getByText(/read on this device and is not uploaded or stored/i)).toBeInTheDocument();
    choose(photo());
    await screen.findByText(/Found 2 subjects/);
    expect(onDetected).toHaveBeenCalledWith([
      expect.objectContaining({ code: 'BM', grade: 'A+' }),
      expect.objectContaining({ code: 'MATH', grade: 'B' }),
    ]);
    expect(screen.getByText(/Check every grade before saving/)).toBeInTheDocument();
  });

  it('rejects files that are not photos, or too large, without reading them', async () => {
    const recognise = vi.fn();
    render(<SpmResultUpload subjects={SUBJECTS} onDetected={vi.fn()} recognise={recognise} />);
    choose(photo('application/pdf'));
    await screen.findByText(/Choose a JPG, PNG or WebP photo/);
    choose(photo('image/png', 11 * 1024 * 1024));
    await screen.findByText(/larger than 10 MB/);
    expect(recognise).not.toHaveBeenCalled();
  });

  it('says so when nothing could be read, and when OCR fails', async () => {
    const onDetected = vi.fn();
    const recognise = vi.fn().mockResolvedValueOnce('blurry nothing').mockRejectedValueOnce(new Error('x'));
    render(<SpmResultUpload subjects={SUBJECTS} onDetected={onDetected} recognise={recognise} />);
    choose(photo());
    await screen.findByText(/couldn’t find any subject grades/);
    choose(photo());
    await screen.findByText(/couldn’t read that photo/);
    await waitFor(() => expect(onDetected).not.toHaveBeenCalled());
  });
});

describe('mergeDetectedGrades', () => {
  it('adds new subjects and fills only the SPM actual column', () => {
    const merged = mergeDetectedGrades(
      ['BM'],
      { BM: { form4_final: 'B', spm_actual: 'C' } },
      [
        { code: 'BM', grade: 'A' },
        { code: 'MATH', grade: 'B+' },
      ]
    );
    expect(merged.selectedCodes).toEqual(['BM', 'MATH']);
    expect(merged.grades).toEqual({
      BM: { form4_final: 'B', spm_actual: 'A' },
      MATH: { spm_actual: 'B+' },
    });
  });
});
