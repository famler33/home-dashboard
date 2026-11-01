import { Clock, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLists } from '../../lists/lists-context';
import { LIST_PAGE_PATH } from '../../lists/paths';
import type { MarkedShopping, MarkedTodo } from '../../lists/listsReducer';
import { useDetail } from '../../shell/detail-context';
import { useShell } from '../../shell/shell-context';
import { fitRows } from '../fit-rows';
import { useFittingRows } from '../useFittingRows';
import { CheckCircle } from './CheckCircle';
import { PriorityMark } from './PriorityMark';
import { useUndoWindow } from './useUndoWindow';

const UNDO_MS = 8_000;
const ROW_PX = 56 + 4;
// The "+ n weitere" button keeps a 44px touch target (min-h-11) plus the column gap.
const MORE_PX = 44 + 4;

type Row = (MarkedShopping | MarkedTodo) & { categoryName?: string };

interface Props {
  /** Rows that fit in one column (tests); `null` shows everything, `undefined` measures the tile. */
  budget?: number | null;
}

/** Registry entry point: the tile measures its own space. */
export function ListsTileContent() {
  return <ListsTile />;
}

export function ListsTile({ budget }: Props) {
  const { t } = useTranslation();
  const { view, patch, retry } = useLists();
  const { layout } = useShell();
  const detail = useDetail();
  const undo = useUndoWindow(UNDO_MS);
  const wall = layout === 'tablet';
  const { bodyRef, headRef, bodyRowRef, captionRef, metrics } = useFittingRows(
    wall && budget === undefined,
  );

  const categoryName = (id: string) =>
    view.categories.find((category) => category.id === id)?.name ?? '';
  const shopping: Row[] = view.shopping;
  const todos: Row[] = view.todos.map((todo) => ({
    ...todo,
    categoryName: categoryName(todo.categoryId),
  }));

  const unit = { head: 1, row: 1, more: 1 };
  const heights =
    budget === undefined
      ? metrics
        ? {
            head: metrics.head,
            row: Math.max(metrics.body, ROW_PX),
            more: Math.max(metrics.caption, MORE_PX),
          }
        : null
      : unit;
  const effectiveBudget = budget === undefined ? (metrics?.budget ?? null) : budget;

  const column = (kind: 'shopping' | 'todo', rows: Row[], openCount: number, emptyText: string) => {
    const openRows = rows.filter((row) => row.checkedAt === null).length;
    const fit =
      wall && heights !== null && effectiveBudget !== null
        ? fitRows(
            {
              kita: [],
              kitaHead: 0,
              more: heights.more,
              days: [
                {
                  date: kind,
                  head: heights.head,
                  rows: rows.map(() => heights.row),
                  partial: true,
                },
              ],
            },
            effectiveBudget,
          )
        : null;
    const shown = fit ? (fit.days[0]?.hidden ? 0 : fit.days[0]!.shown) : rows.length;
    const hidden = wall ? rows.length - shown + Math.max(0, openCount - openRows) : 0;
    const name = t(kind === 'shopping' ? 'lists.shopping' : 'lists.todos');
    const headingId = `lists-${kind}`;

    return (
      <section aria-labelledby={headingId} className="flex min-h-0 min-w-0 flex-col gap-1">
        <h3 className="flex items-baseline gap-2 text-caption font-semibold text-ink">
          <span id={headingId}>{name}</span>
          <span className="text-ink-muted">{openCount}</span>
        </h3>
        {rows.length === 0 ? (
          <p className="text-caption text-ink-muted">{emptyText}</p>
        ) : openRows === 0 ? (
          <p className="text-caption text-ink-muted">{t('lists.allDone')}</p>
        ) : null}
        <ul className="flex flex-col">
          {rows.slice(0, shown).map((row) => (
            <li
              key={row.id}
              data-testid="list-row"
              data-title={row.title}
              className={`flex items-center gap-2 text-caption ${wall ? 'min-h-14' : 'min-h-11'} ${
                row.checkedAt !== null ? 'opacity-60' : ''
              }`}
            >
              <CheckCircle
                checked={row.checkedAt !== null}
                label={row.title}
                wall={wall}
                onToggle={() => {
                  const next = row.checkedAt === null;
                  patch(row.id, { checked: next });
                  if (next) undo.start(row.id);
                  else undo.stop(row.id);
                }}
              />
              {'priority' in row && <PriorityMark level={row.priority} />}
              <span
                data-testid="row-title"
                title={row.title}
                className={`min-w-0 flex-1 truncate ${row.checkedAt !== null ? 'line-through' : ''}`}
              >
                {row.title}
              </span>
              {row.categoryName && (
                <span className="max-w-[40%] shrink-0 truncate text-ink-muted tablet-short:hidden">
                  {row.categoryName}
                </span>
              )}
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
              {undo.ids.has(row.id) && (
                <button
                  type="button"
                  onClick={() => {
                    patch(row.id, { checked: false });
                    undo.stop(row.id);
                  }}
                  className="min-h-11 shrink-0 rounded-full bg-surface px-3 font-semibold text-ink"
                >
                  {t('lists.undo')}
                </button>
              )}
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <button
            type="button"
            onClick={(event) => detail.open('lists-live', event.currentTarget)}
            className="min-h-11 self-start text-left text-caption font-semibold text-ink-muted"
          >
            {t('lists.more', { count: hidden })}
          </button>
        )}
      </section>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      {view.failedCount > 0 && (
        <button
          type="button"
          onClick={retry}
          className="flex min-h-11 items-center gap-2 self-start text-caption font-semibold text-warn"
        >
          <TriangleAlert aria-hidden="true" className="h-[1em] w-[1em]" />
          {t('lists.unsaved', { count: view.failedCount })}
        </button>
      )}
      <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden="true"
          className="invisible absolute inset-x-0 top-0 -z-10 h-0 overflow-clip"
        >
          <div ref={headRef} className="text-caption font-semibold">
            {'M'}
          </div>
          <div ref={bodyRowRef} className="text-caption">
            {'M'}
          </div>
          <div ref={captionRef} className="text-caption">
            {'M'}
          </div>
        </div>
        <div className={wall ? 'grid grid-cols-2 gap-6' : 'flex flex-col gap-3'}>
          {column('shopping', shopping, view.counts.shoppingOpen, t('lists.emptyShopping'))}
          {column('todo', todos, view.counts.todoOpen, t('lists.emptyTodos'))}
        </div>
      </div>
      {!wall && (
        <a
          href={LIST_PAGE_PATH}
          className="flex min-h-11 items-center self-start rounded-full bg-surface px-4 text-caption font-semibold text-ink"
        >
          {t('lists.openPage')}
        </a>
      )}
    </div>
  );
}
