import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ListsCategory } from '../api/lists-types';
import { useVisualViewportHeight } from './useVisualViewportHeight';

interface Props {
  layout: 'wall' | 'phone';
  categories: readonly ListsCategory[];
  onAdd(name: string): void;
  onRename(id: string, name: string): void;
  onRemove(id: string): void;
  onClose(): void;
}

/** Add, rename and remove categories; removing says how many open to-dos move to "Sonstiges" first. */
export function CategoryManager({ layout, categories, onAdd, onRename, onRemove, onClose }: Props) {
  const { t } = useTranslation();
  const height = useVisualViewportHeight();
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('lists.manageCategories')}
        style={height !== null && layout === 'wall' ? { maxHeight: `${height}px` } : undefined}
        className="flex w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-3xl bg-surface-raised p-5 shadow-lg"
      >
        <h3 className="text-title text-ink">{t('lists.manageCategories')}</h3>
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li
              key={category.id}
              data-testid={`category-${category.id}`}
              className="flex flex-wrap items-center gap-2"
            >
              {category.builtin ? (
                <span className="min-h-11 flex-1 px-4 py-2 text-body text-ink">
                  {category.name}
                </span>
              ) : (
                <>
                  <input
                    aria-label={category.name}
                    defaultValue={category.name}
                    maxLength={20}
                    onBlur={(event) => {
                      const next = event.target.value.trim();
                      if (next !== '' && next !== category.name) onRename(category.id, next);
                    }}
                    className="min-h-11 flex-1 rounded-2xl bg-surface px-4 text-body text-ink"
                  />
                  <button
                    type="button"
                    aria-label={t('lists.remove')}
                    onClick={() => setConfirming(category.id)}
                    className="min-h-11 rounded-2xl px-4 text-body text-danger ring-1 ring-danger"
                  >
                    {t('lists.remove')}
                  </button>
                  {confirming === category.id && (
                    <div className="flex w-full flex-wrap items-center gap-2 text-caption text-ink">
                      <span>{t('lists.categoryMoves', { count: category.openTodoCount })}</span>
                      <button
                        type="button"
                        onClick={() => {
                          onRemove(category.id);
                          setConfirming(null);
                        }}
                        className="min-h-11 rounded-2xl bg-danger px-4 text-body text-surface-raised"
                      >
                        {t('lists.confirmRemove')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="min-h-11 rounded-2xl bg-surface px-4 text-body text-ink"
                      >
                        {t('lists.cancel')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = name.trim();
            if (next === '') return;
            onAdd(next);
            setName('');
          }}
        >
          <input
            aria-label={t('lists.categoryNew')}
            value={name}
            maxLength={20}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('lists.categoryNew')}
            className="min-h-11 flex-1 rounded-2xl bg-surface px-4 text-body text-ink"
          />
          <button
            type="submit"
            className="min-h-11 rounded-2xl bg-ink px-4 text-body font-semibold text-surface-raised"
          >
            {t('lists.add')}
          </button>
        </form>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 self-end rounded-2xl bg-surface px-4 text-body text-ink"
        >
          {t('lists.dismiss')}
        </button>
      </div>
    </div>
  );
}
