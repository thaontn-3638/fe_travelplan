export const WIZARD_STEPS = [1, 2, 3, 4] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

// Không còn bước nào bị khoá: Bước 4 (Dự trù chi phí) đã dựng ở Đợt 7.
// Giữ hằng số để sơ đồ bước vẫn có chỗ khoá khi cần trong tương lai.
export const LOCKED_STEPS: WizardStep[] = [];
