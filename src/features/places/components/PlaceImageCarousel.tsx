import { useEffect, useState } from 'react';
import { IconButton } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useTranslation } from 'react-i18next';

interface PlaceImageCarouselProps {
  images: string[];
  alt: string;
  // Jumps back to the first image whenever this changes (pass the selected
  // place's id) — otherwise switching places would keep showing whatever
  // slide the previous place was left on.
  resetKey: string;
}

export function PlaceImageCarousel({ images, alt, resetKey }: PlaceImageCarouselProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [resetKey]);

  const hasMultiple = images.length > 1;
  const current = images[index] ?? images[0];

  function goPrev(): void {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }

  function goNext(): void {
    setIndex((i) => (i + 1) % images.length);
  }

  return (
    <div className="relative h-72 w-full flex-shrink-0 overflow-hidden bg-line">
      <img src={current} alt={alt} className="h-full w-full object-cover" />

      {hasMultiple && (
        <>
          {/* `sx`, not a Tailwind class — MUI's ButtonBase sets its own `position: relative`
              at higher cascade priority and would otherwise win the tie (see dashboard.md). */}
          <IconButton
            size="small"
            onClick={goPrev}
            aria-label={t('discover.previousImage') as string}
            sx={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(255,255,255,0.85)',
              '&:hover': { backgroundColor: '#fff' },
            }}
          >
            <ChevronLeftRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={goNext}
            aria-label={t('discover.nextImage') as string}
            sx={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(255,255,255,0.85)',
              '&:hover': { backgroundColor: '#fff' },
            }}
          >
            <ChevronRightRoundedIcon fontSize="small" />
          </IconButton>

          <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {images.map((image, i) => (
              <button
                key={image + i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t('discover.goToImage', { index: i + 1 }) as string}
                aria-current={i === index}
                className={`rounded-full bg-white transition-all ${i === index ? 'h-2 w-2 opacity-100' : 'h-1.5 w-1.5 opacity-60 hover:opacity-80'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
