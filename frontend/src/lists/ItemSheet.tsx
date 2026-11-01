import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ListsCategory, Priority, TodoItem } from '../api/lists-types';
import type { NewTodo } from './lists-context';
import { useVisualViewportHeight } from './useVisualViewportHeight';

interface Props {
  layout: 'wall' | 'phone';
  categories: readonly ListsCategory[];
  /** The to-do to edit; without it the sheet adds a new one. */
  item?: TodoItem;
  defaultCategoryId: string;
  onAdd(input: NewTodo): void;
  onSave(id: string, changes: Record<string, unknown>): void;
  onRemove?(id: string): void;
  onClose(): void;
}

const levels: Priority[] = ['high', 'medium', 'low'];

function parseEffort(raw: string): number | null | 'invalid' {
  const text = raw.trim().replace(',', '.');
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 99 || !Number.isInteger(value * 2))
    return 'invalid';
  return value;
}

/** Add or edit a to-do: a centred panel on the wall tablet, a bottom sheet on the phone, sized to the visible area. */
export function ItemSheet({
  layout,
  categories,
  item,
  defaultCategoryId,
  onAdd,
  onSave,
  onRemove,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const height = useVisualViewportHeight();
  const [title, setTitle] = useState(item?.title ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? defaultCategoryId);
  const [priority, setPriority] = useState<Priority>(item?.priority ?? 'medium');
  const [effort, setEffort] = useState(
    item?.effortHours === null || item?.effortHours === undefined
      ? ''
      : String(item.effortHours).replace('.', ','),
  );
  const [prerequisite, setPrerequisite] = useState(item?.prerequisite ?? '');
  const [errors, setErrors] = useState<{ title?: string; effort?: string }>({});
  const wall = layout === 'wall';

  const submit = () => {
    const found: { title?: string; effort?: string } = {};
    const text = title.trim();
    const hours = parseEffort(effort);
    if (text === '') found.title = t('lists.errors.titleRequired');
    if (hours === 'invalid') found.effort = t('lists.errors.effort');
    setErrors(found);
    if (found.title || found.effort || hours === 'invalid') return;

    const note = prerequisite.trim() === '' ? null : prerequisite.trim();
    if (!item) {
      onAdd({ title: text, categoryId, priority, effortHours: hours, prerequisite: note });
    } else {
      const changes: Record<string, unknown> = {};
      if (text !== item.title) changes['title'] = text;
      if (categoryId !== item.categoryId) changes['categoryId'] = categoryId;
      if (priority !== item.priority) changes['priority'] = priority;
      if (hours !== item.effortHours) changes['effortHours'] = hours;
      if (note !== item.prerequisite) changes['prerequisite'] = note;
      if (Object.keys(changes).length > 0) onSave(item.id, changes);
    }
    onClose();
  };

  const field = 'min-h-11 w-full rounded-2xl bg-surface px-4 text-body text-ink';
  return (
    <div
      className={`absolute inset-0 z-30 flex justify-center bg-ink/40 p-4 ${wall ? 'items-center' : 'items-end'}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(item ? 'lists.editTodo' : 'lists.newTodo')}
        style={height !== null && wall ? { maxHeight: `${height}px` } : undefined}
        className={`flex w-full flex-col gap-3 overflow-y-auto rounded-3xl bg-surface-raised p-5 shadow-lg ${wall ? 'max-w-2xl' : 'max-w-xl'}`}
      >
        <h3 className="text-title text-ink">{t(item ? 'lists.editTodo' : 'lists.newTodo')}</h3>
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          {t('lists.fields.title')}
          <input
            className={field}
            value={title}
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        {errors.title && <span className="-mt-2 text-caption text-danger">{errors.title}</span>}
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          {t('lists.fields.category')}
          <select
            className={field}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1 text-caption text-ink-muted">
          <legend>{t('lists.fields.priority')}</legend>
          <div className="flex gap-2">
            {levels.map((level) => (
              <label
                key={level}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-2xl px-3 text-body ${priority === level ? 'bg-ink text-surface-raised' : 'bg-surface text-ink'}`}
              >
                <input
                  type="radio"
                  name="priority"
                  className="sr-only"
                  checked={priority === level}
                  onChange={() => setPriority(level)}
                />
                {t(`lists.priorityLabel.${level}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          {t('lists.fields.effort')}
          <input
            className={field}
            inputMode="decimal"
            value={effort}
            onChange={(event) => setEffort(event.target.value)}
          />
        </label>
        {errors.effort && <span className="-mt-2 text-caption text-danger">{errors.effort}</span>}
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          {t('lists.fields.prerequisite')}
          <input
            className={field}
            value={prerequisite}
            maxLength={80}
            onChange={(event) => setPrerequisite(event.target.value)}
          />
        </label>
        <div className="sticky bottom-0 flex flex-wrap gap-2 bg-surface-raised pt-2">
          <button
            type="button"
            onClick={submit}
            className="min-h-11 flex-1 rounded-2xl bg-ink px-4 text-body font-semibold text-surface-raised"
          >
            {t(item ? 'lists.save' : 'lists.add')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-2xl bg-surface px-4 text-body text-ink"
          >
            {t('lists.cancel')}
          </button>
          {item && onRemove && (
            <button
              type="button"
              onClick={() => {
                onRemove(item.id);
                onClose();
              }}
              className="min-h-11 rounded-2xl px-4 text-body text-danger ring-1 ring-danger"
            >
              {t('lists.remove')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
