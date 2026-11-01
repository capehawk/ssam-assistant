// Synthetic catalog only; no real school or staff data.
export const DEMO_CATALOG = [
  { id: 'safety', title: '안전교육 (시연)', kind: 'training' },
  { id: 'privacy', title: '개인정보보호 (시연)', kind: 'training' },
  { id: 'child-protection', title: '아동보호 (시연)', kind: 'training' },
  { id: 'mandatory-bundle', title: '필수연수 묶음 (시연)', kind: 'bundle', itemIds: ['safety', 'privacy', 'child-protection'] }
];
