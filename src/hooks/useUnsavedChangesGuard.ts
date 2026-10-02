import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

interface UnsavedChangesGuard {
  blocked: boolean;
  confirm: () => void;
  cancel: () => void;
  // Gọi ngay trước khi tự điều hướng sau khi đã lưu: state `trip` cập nhật bất
  // đồng bộ nên `isDirty` có thể còn true ở thời điểm navigate, khiến blocker
  // bật modal ngay sau một thao tác lưu thành công.
  bypassOnce: () => void;
}

// R10 — chặn rời trang khi còn thay đổi chưa lưu: `useBlocker` cho điều hướng
// trong app, `beforeunload` cho reload/đóng tab.
export function useUnsavedChangesGuard(isDirty: boolean): UnsavedChangesGuard {
  const bypass = useRef(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (bypass.current) {
      bypass.current = false;
      return false;
    }
    return isDirty && currentLocation.pathname !== nextLocation.pathname;
  });

  const bypassOnce = useCallback(() => {
    bypass.current = true;
  }, []);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return {
    blocked: blocker.state === 'blocked',
    confirm: () => blocker.proceed?.(),
    cancel: () => blocker.reset?.(),
    bypassOnce,
  };
}
