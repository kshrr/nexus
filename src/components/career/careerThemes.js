const themes = {
  'Computing & Technology': ['#346c91', '#e9f1f6'],
  Engineering: ['#af791c', '#fbf0d8'],
  'Business & Finance': ['#688039', '#eef3df'],
  Science: ['#477b68', '#e7f2eb'],
  Healthcare: ['#b75746', '#f9e8e2'],
  Education: ['#997350', '#f7efe1'],
  'Creative & Design': ['#816897', '#f0e9f6'],
  'Social Sciences': ['#6b7884', '#e9eef3'],
};
export function careerThemeStyle(field) {
  const [line, soft] = Object.hasOwn(themes, field) ? themes[field] : ['#24344b', '#eeeee8'];
  return { '--career-category': line, '--career-category-soft': soft };
}
