import { Clock, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Priority } from '../api/lists-types';
import { useDetailBusy } from '../shell/detail-context';
import { CheckCircle } from '../tiles/lists/CheckCircle';
import { PriorityMark } from '../tiles/lists/PriorityMark';
import { CategoryManager } from './CategoryManager';
import { ItemSheet } from './ItemSheet';
import { useLists, useListsEditor } from './lists-context';
import type { MarkedShopping, MarkedTodo } from './listsReducer';

const UNDO_MS = 8_000;
const MAX_SUGGESTIONS = 5;
const levels: Priority[] = ['high', 'medium', 'low'];
const key = (text: string) => text.normalize('NFC').trim().toLocaleLowerCase('de');

type Undo = { kind: 'item' | 'category'; id: string } | null;

/** The complete lists with editing, shared by the tablet detail view and the phone page. */
export function ListsEditor({ layout }: { layout: 'wall' | 'phone' }) {
  const { t } = useTranslation();
  const lists = useLists();
  const { view } = lists;
  const { setBusy } = useDetailBusy();
  const wall = layout === 'wall';
  useListsEditor();

  const [filter, setFilter] = useState<string>('all');
  const [sheet, setSheet] = useState<{ item?: MarkedTodo } | null>(null);
  const [manager, setManager] = useState(false);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [chooser, setChooser] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo>(null);
  const timers = useRef<{
    undo?: ReturnType<typeof setTimeout>;
    highlight?: ReturnType<typeof setTimeout>;
  }>({});

  const sheetOpen = sheet !== null || manager;
  useEffect(() => {
    lists.setHold(sheetOpen || focused);
    setBusy(sheetOpen || text.trim() !== '');
    // the lists controller object changes with every state; only the flags matter here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, focused, text]);
  useEffect(
    () => () => {
      clearTimeout(timers.current.undo);
      clearTimeout(timers.current.highlight);
      setBusy(false);
      lists.setHold(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const offerUndo = (next: Undo) => {
    setUndo(next);
    clearTimeout(timers.current.undo);
    timers.current.undo = setTimeout(() => setUndo(null), UNDO_MS);
  };

  const openTitles = new Set(
    view.shopping.filter((item) => item.checkedAt === null).map((item) => key(item.title)),
  );
  const suggestions =
    text.trim() === ''
      ? []
      : view.suggestions
          .filter((title) => key(title).includes(key(text)) && !openTitles.has(key(title)))
          .slice(0, MAX_SUGGESTIONS);

  const submitShopping = () => {
    const title = text.trim();
    if (title === '') return;
    const existing = view.shopping.find(
      (item) => item.checkedAt === null && key(item.title) === key(title),
    );
    if (existing) {
      setHighlight(existing.id);
      clearTimeout(timers.current.highlight);
      timers.current.highlight = setTimeout(() => setHighlight(null), 3000);
      return;
    }
    lists.addShopping(title);
    setText('');
  };

  const todos = view.todos.filter((todo) => filter === 'all' || todo.categoryId === filter);
  const target = wall ? 'min-h-14 min-w-14' : 'min-h-11 min-w-11';
  const categoryName = (id: string) =>
    view.categories.find((category) => category.id === id)?.name ?? '';

  const marker = (row: MarkedShopping | MarkedTodo) => (
    <>
      {row.failed && (
        <span className="flex shrink-0 items-center gap-1 text-warn">
          <TriangleAlert aria-hidden="true" className="h-[1em] w-[1em]" />
          {t('lists.notSaved')}
        </span>
      )}
      {row.pending && (
        <span className="shrink-0 text-ink-muted">
          <Clock aria-hidden="true" className="h-[1em] w-[1em]" />
          <span className="sr-only">{t('lists.saving')}</span>
        </span>
      )}
    </>
  );

  const removeButton = (id: string, title: string) => (
    <button
      type="button"
      aria-label={`${t('lists.remove')}: ${title}`}
      onClick={() => {
        lists.remove(id);
        offerUndo({ kind: 'item', id });
      }}
      className={`${target} flex shrink-0 items-center justify-center text-ink-muted`}
    >
      <Trash2 aria-hidden="true" className="h-[1.2em] w-[1.2em]" />
    </button>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 text-body text-ink">
      {view.notice && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl bg-surface-raised px-4 py-2 text-caption text-warn"
        >
          <span>
            {t(`lists.errors.codes.${view.notice.code}`, {
              defaultValue: t('lists.errors.codes.LISTS_REQUEST_FAILED'),
            })}
          </span>
          <button type="button" onClick={lists.dismissNotice} className={`${target} px-3 text-ink`}>
            {t('lists.dismiss')}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-caption">
        <span className="rounded-full bg-surface-raised px-3 py-1">
          {t('lists.openCount', { count: view.counts.todoOpen })}
        </span>
        <span className="rounded-full bg-surface-raised px-3 py-1 text-danger">
          {t('lists.highCount', { count: view.counts.todoHigh })}
        </span>
        <button
          type="button"
          onClick={() => setManager(true)}
          className={`${target} ml-auto rounded-full px-4 text-ink-muted ring-1 ring-ink-muted/40`}
        >
          {t('lists.manageCategories')}
        </button>
      </div>
      <div className={`flex gap-2 ${wall ? 'flex-wrap' : 'overflow-x-auto'}`}>
        {[
          { id: 'all', name: t('lists.allCategories'), count: view.counts.todoOpen },
          ...view.categories.map((category) => ({
            id: category.id,
            name: category.name,
            count: category.openTodoCount,
          })),
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={filter === chip.id}
            onClick={() => setFilter(chip.id)}
            className={`${wall ? 'min-h-14' : 'min-h-11'} shrink-0 rounded-full px-4 text-caption ${filter === chip.id ? 'bg-ink font-semibold text-surface-raised' : 'bg-surface-raised text-ink ring-1 ring-ink-muted/40'}`}
          >
            {chip.name} <span className="opacity-70">{chip.count}</span>
          </button>
        ))}
      </div>

      <div
        className={`min-h-0 flex-1 ${wall ? 'grid grid-cols-2 gap-6' : 'flex flex-col gap-6 overflow-y-auto'}`}
      >
        <section aria-labelledby="editor-shopping" className="flex min-h-0 flex-col gap-2">
          <h3 id="editor-shopping" className="text-title text-ink">
            {t('lists.shopping')}
          </h3>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitShopping();
            }}
          >
            <div className="flex gap-2">
              <input
                value={text}
                maxLength={80}
                placeholder={t('lists.addShoppingPlaceholder')}
                aria-label={t('lists.addShoppingPlaceholder')}
                onChange={(event) => setText(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="min-h-11 flex-1 rounded-2xl bg-surface-raised px-4 text-body text-ink"
              />
              <button
                type="submit"
                className={`${wall ? 'min-h-14' : 'min-h-11'} rounded-2xl bg-ink px-4 text-body font-semibold text-surface-raised`}
              >
                {t('lists.add')}
              </button>
            </div>
            {highlight && <p className="text-caption text-warn">{t('lists.alreadyOnList')}</p>}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((title) => (
                  <button
                    key={title}
                    type="button"
                    data-testid="suggestion"
                    onClick={() => {
                      lists.addShopping(title);
                      setText('');
                    }}
                    className={`${wall ? 'min-h-14' : 'min-h-11'} rounded-full bg-surface-raised px-4 text-caption text-ink`}
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </form>
          <ul className="flex min-h-0 flex-col overflow-y-auto">
            {view.shopping.map((item) => (
              <li
                key={item.id}
                data-testid="editor-row"
                data-title={item.title}
                data-highlight={highlight === item.id ? 'true' : undefined}
                className={`flex items-center gap-2 ${item.checkedAt !== null ? 'opacity-60' : ''} ${highlight === item.id ? 'rounded-2xl bg-surface-raised' : ''}`}
              >
                <CheckCircle
                  checked={item.checkedAt !== null}
                  label={item.title}
                  wall={wall}
                  onToggle={() => lists.patch(item.id, { checked: item.checkedAt === null })}
                />
                <span className={`min-w-0 flex-1 ${item.checkedAt !== null ? 'line-through' : ''}`}>
                  {item.title}
                </span>
                {marker(item)}
                {removeButton(item.id, item.title)}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="editor-todos" className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 id="editor-todos" className="text-title text-ink">
              {t('lists.todos')}
            </h3>
            <button
              type="button"
              aria-label={t('lists.addTodo')}
              onClick={() => setSheet({})}
              className={`${wall ? 'min-h-14 min-w-14' : 'min-h-11 min-w-11'} flex items-center justify-center rounded-full bg-ink text-surface-raised`}
            >
              <Plus aria-hidden="true" className="h-[1.3em] w-[1.3em]" />
            </button>
          </div>
          <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
            {todos.map((todo) => (
              <li
                key={todo.id}
                data-testid="editor-row"
                data-title={todo.title}
                className={`relative flex items-start gap-2 ${todo.checkedAt !== null ? 'opacity-60' : ''}`}
              >
                <CheckCircle
                  checked={todo.checkedAt !== null}
                  label={todo.title}
                  wall={wall}
                  onToggle={() => lists.patch(todo.id, { checked: todo.checkedAt === null })}
                />
                <button
                  type="button"
                  onClick={() => setChooser(chooser === todo.id ? null : todo.id)}
                  aria-haspopup="menu"
                  className={`${target} flex shrink-0 items-center justify-center`}
                >
                  <PriorityMark level={todo.priority} />
                </button>
                <div className="min-w-0 flex-1 py-2">
                  <p className={`${todo.checkedAt !== null ? 'line-through' : ''}`}>{todo.title}</p>
                  <p className="flex flex-wrap gap-x-3 text-caption text-ink-muted">
                    <span>{categoryName(todo.categoryId)}</span>
                    {todo.effortHours !== null && (
                      <span>
                        {t('lists.effortValue', {
                          value: String(todo.effortHours).replace('.', ','),
                        })}
                      </span>
                    )}
                    {todo.prerequisite && <span>{todo.prerequisite}</span>}
                  </p>
                  {marker(todo)}
                </div>
                <button
                  type="button"
                  aria-label={t('lists.editTodo')}
                  onClick={() => setSheet({ item: todo })}
                  className={`${target} flex shrink-0 items-center justify-center text-ink-muted`}
                >
                  <Pencil aria-hidden="true" className="h-[1.2em] w-[1.2em]" />
                </button>
                {removeButton(todo.id, todo.title)}
                {chooser === todo.id && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-20 flex flex-col gap-1 rounded-2xl bg-surface-raised p-2 shadow-lg"
                  >
                    {levels.map((level) => (
                      <button
                        key={level}
                        type="button"
                        role="menuitemradio"
                        aria-checked={todo.priority === level}
                        onClick={() => {
                          if (level !== todo.priority) lists.patch(todo.id, { priority: level });
                          setChooser(null);
                        }}
                        className={`${wall ? 'min-h-14' : 'min-h-11'} rounded-xl px-4 text-left text-body ${todo.priority === level ? 'bg-ink text-surface-raised' : 'text-ink'}`}
                      >
                        {t(`lists.priorityLabel.${level}`)}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {undo && (
        <div
          role="status"
          className="absolute inset-x-0 bottom-2 z-30 mx-auto flex w-fit items-center gap-3 rounded-full bg-ink px-5 py-2 text-caption text-surface-raised shadow-lg"
        >
          <span>{t(undo.kind === 'item' ? 'lists.removed' : 'lists.categoryRemoved')}</span>
          <button
            type="button"
            onClick={() => {
              if (undo.kind === 'item') lists.restore(undo.id);
              else lists.restoreCategory(undo.id);
              setUndo(null);
            }}
            className={`${target} font-semibold underline`}
          >
            {t('lists.undo')}
          </button>
        </div>
      )}

      {sheet && (
        <ItemSheet
          layout={layout}
          categories={view.categories}
          {...(sheet.item ? { item: sheet.item } : {})}
          defaultCategoryId={filter === 'all' ? 'sonstiges' : filter}
          onAdd={lists.addTodo}
          onSave={(id, changes) => lists.patch(id, changes)}
          onRemove={(id) => {
            lists.remove(id);
            offerUndo({ kind: 'item', id });
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {manager && (
        <CategoryManager
          layout={layout}
          categories={view.categories}
          onAdd={lists.addCategory}
          onRename={lists.renameCategory}
          onRemove={(id) => {
            lists.removeCategory(id);
            offerUndo({ kind: 'category', id });
          }}
          onClose={() => setManager(false)}
        />
      )}
    </div>
  );
}
