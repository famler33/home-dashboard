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
  const wall = layout === 'wall';
  const target = wall ? 'min-h-14' : 'min-h-11';
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-ink/40 p-4 ${wall ? 'items-center' : 'items-end'}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('lists.manageCategories')}
        style={{
          maxHeight: `${height !== null ? Math.min(height, window.innerHeight) - 32 : window.innerHeight - 32}px`,
        }}
        className="flex w-full max-w-2xl flex-col gap-3 rounded-3xl bg-surface-raised p-5 shadow-lg"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-title text-ink">{t('lists.manageCategories')}</h3>
          <button
            type="button"
            onClick={onClose}
            className={`${target} rounded-2xl bg-surface px-5 text-body text-ink`}
          >
            {t('lists.dismiss')}
          </button>
        </div>
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1">
          {categories.map((category) => (
            <li
              key={category.id}
              data-testid={`category-${category.id}`}
              className="flex flex-wrap items-center gap-x-2 gap-y-1"
            >
              {category.builtin ? (
                <span className={`${target} flex flex-1 items-center px-4 text-body text-ink`}>
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
                    className={`${target} min-w-0 flex-1 rounded-2xl bg-surface px-4 text-body text-ink`}
                  />
                  <button
                    type="button"
                    aria-label={t('lists.remove')}
                    onClick={() => setConfirming(category.id)}
                    className={`${target} shrink-0 rounded-2xl px-4 text-body text-danger ring-1 ring-danger`}
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
                        className={`${target} rounded-2xl bg-danger px-4 text-body text-surface-raised`}
                      >
                        {t('lists.confirmRemove')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className={`${target} rounded-2xl bg-surface px-4 text-body text-ink`}
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
            className={`${target} min-w-0 flex-1 rounded-2xl bg-surface px-4 text-body text-ink`}
          />
          <button
            type="submit"
            className={`${target} shrink-0 rounded-2xl bg-ink px-4 text-body font-semibold text-surface-raised`}
          >
            {t('lists.add')}
          </button>
        </form>
      </div>
    </div>
  );
}
