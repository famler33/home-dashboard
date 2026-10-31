import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import golden from '../../../backend/test/fixtures/lists/lists.state.sample.json';
import type { ListsState } from '../api/lists-types';
import { createI18n, i18n } from '../i18n';
import { de } from '../i18n/de';
import { DetailBusyContext } from '../shell/detail-context';
import { renderWithProviders } from '../test-utils';
import { ListsEditor } from './ListsEditor';
import { ListsContext, type ListsController } from './lists-context';
import { initialModel, selectView, type ListsView } from './listsReducer';

const state = golden as unknown as ListsState;

function viewOf(change: (value: ListsView) => void = () => undefined): ListsView {
  const view = selectView({ ...initialModel, base: state, full: true });
  change(view);
  return view;
}

function makeController(view: ListsView = viewOf()) {
  const spies = {
    addShopping: vi.fn(() => 'new-id'),
    addTodo: vi.fn(() => 'new-todo'),
    patch: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
    addCategory: vi.fn(() => 'cat'),
    renameCategory: vi.fn(),
    removeCategory: vi.fn(),
    restoreCategory: vi.fn(),
    retry: vi.fn(),
    dismissNotice: vi.fn(),
    setHold: vi.fn(),
    registerEditor: vi.fn(() => vi.fn()),
  };
  return { controller: { view, ...spies } as ListsController, spies };
}

function show(
  options: {
    view?: ListsView;
    layout?: 'wall' | 'phone';
    busy?: (on: boolean) => void;
    instance?: ReturnType<typeof createI18n>;
  } = {},
) {
  const { controller, spies } = makeController(options.view);
  const busy = { setBusy: options.busy ?? vi.fn() };
  renderWithProviders(
    <ListsContext.Provider value={controller}>
      <DetailBusyContext.Provider value={busy}>
        <ListsEditor layout={options.layout ?? 'phone'} />
      </DetailBusyContext.Provider>
    </ListsContext.Provider>,
    undefined,
    options.instance,
  );
  return { spies, busy };
}

const shoppingSection = () => screen.getByRole('region', { name: de.lists.shopping });
const todoSection = () => screen.getByRole('region', { name: de.lists.todos });

beforeEach(() =>
  vi.useFakeTimers({
    now: Date.parse('2026-10-28T10:30:00Z'),
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  }),
);
afterEach(() => vi.useRealTimers());

// Covers: FR-5, FR-6, FR-7, NFR-3, NFR-5, AC-18, AC-20, AC-21, AC-22, AC-23, AC-26, AC-27, AC-31, AC-33, AC-35, AC-37, AC-38, AC-41, AC-42, AC-53, AC-54
describe('ListsEditor lists and filters', () => {
  it('shows both lists completely and registers the editor for polling', () => {
    const { spies } = show();
    expect(within(shoppingSection()).getAllByTestId('editor-row')).toHaveLength(2);
    expect(within(todoSection()).getAllByTestId('editor-row')).toHaveLength(3);
    expect(spies.registerEditor).toHaveBeenCalled();
  });

  it('shows the counts of open and high-priority to-dos and filters by category with counts on the chips', () => {
    show();
    expect(screen.getByText('3 offen')).toBeInTheDocument();
    expect(screen.getByText('1 hohe Prio')).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: /Büro/ });
    expect(chip).toHaveTextContent('1');
    fireEvent.click(chip);
    const rows = within(todoSection()).getAllByTestId('editor-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('data-title', 'Verkabelung Schreibtisch');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(de.lists.allCategories) }));
    expect(within(todoSection()).getAllByTestId('editor-row')).toHaveLength(3);
  });

  it('shows effort and prerequisite on a to-do and the unit as text', () => {
    show();
    const row = within(todoSection()).getAllByTestId('editor-row')[1]!;
    expect(within(row).getByText('2 Std')).toBeInTheDocument();
    expect(within(row).getByText('Lampen kaufen')).toBeInTheDocument();
  });

  it('uses 44 px targets on the phone and 56 px on the wall', () => {
    show();
    expect(within(shoppingSection()).getAllByRole('checkbox')[0]!.className).toMatch(/min-h-11/);
    expect(
      screen.getByRole('button', { name: new RegExp(de.lists.allCategories) }).className,
    ).toMatch(/min-h-11/);
  });

  it('uses 56 px targets on the wall', () => {
    show({ layout: 'wall' });
    expect(within(shoppingSection()).getAllByRole('checkbox')[0]!.className).toMatch(/min-h-14/);
    expect(
      screen.getByRole('button', { name: new RegExp(de.lists.allCategories) }).className,
    ).toMatch(/min-h-14/);
  });

  it('checks, unchecks and removes entries and marks pending and failed rows', () => {
    const view = viewOf((value) => {
      value.shopping[0] = { ...value.shopping[0]!, pending: true };
      value.todos[0] = { ...value.todos[0]!, failed: true };
    });
    const { spies } = show({ view });
    fireEvent.click(within(shoppingSection()).getAllByRole('checkbox')[0]!);
    expect(spies.patch).toHaveBeenCalledWith(state.shopping[0]!.id, { checked: true });
    expect(within(shoppingSection()).getByText(de.lists.saving)).toBeInTheDocument();
    expect(within(todoSection()).getByText(de.lists.notSaved)).toBeInTheDocument();
    fireEvent.click(
      within(todoSection()).getAllByRole('button', { name: new RegExp(de.lists.remove) })[0]!,
    );
    expect(spies.remove).toHaveBeenCalledWith(state.todos[0]!.id);
  });
});

describe('ListsEditor shopping input', () => {
  it('adds an entry from the input and clears it', () => {
    const { spies } = show();
    const input = within(shoppingSection()).getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Käse' } });
    fireEvent.submit(input.closest('form')!);
    expect(spies.addShopping).toHaveBeenCalledWith('Käse');
    expect(input).toHaveValue('');
  });

  it('offers at most five matching earlier entries that are not open and adds one with a single tap', () => {
    const view = viewOf((value) => {
      value.suggestions = ['Milch', 'Mehl', 'Mandeln', 'Mais', 'Muskat', 'Mozzarella', 'Eier'];
    });
    const { spies } = show({ view });
    fireEvent.change(within(shoppingSection()).getByRole('textbox'), { target: { value: 'm' } });
    const offers = within(shoppingSection()).getAllByTestId('suggestion');
    expect(offers).toHaveLength(5);
    expect(offers.map((offer) => offer.textContent)).not.toContain('Eier');
    fireEvent.click(offers[0]!);
    expect(spies.addShopping).toHaveBeenCalledWith('Milch');
  });

  it('does not add a title that is already open and highlights the existing row', () => {
    const { spies } = show();
    const input = within(shoppingSection()).getByRole('textbox');
    fireEvent.change(input, { target: { value: ' eier ' } });
    fireEvent.submit(input.closest('form')!);
    expect(spies.addShopping).not.toHaveBeenCalled();
    expect(within(shoppingSection()).getByText(de.lists.alreadyOnList)).toBeInTheDocument();
    expect(within(shoppingSection()).getAllByTestId('editor-row')[0]).toHaveAttribute(
      'data-highlight',
      'true',
    );
  });

  it('limits the title to 80 characters', () => {
    show();
    expect(within(shoppingSection()).getByRole('textbox')).toHaveAttribute('maxlength', '80');
  });
});

describe('ListsEditor to-do sheet', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: de.lists.addTodo }));
  const sheet = () => screen.getByRole('dialog', { name: de.lists.newTodo });

  it('preselects Mittel and the selected category filter and adds a to-do with all fields', () => {
    const { spies, busy } = show();
    fireEvent.click(screen.getByRole('button', { name: /Büro/ }));
    open();
    expect(
      within(sheet()).getByRole('radio', { name: de.lists.priorityLabel.medium }),
    ).toBeChecked();
    expect(within(sheet()).getByLabelText(de.lists.fields.category)).toHaveValue('buero');
    expect(vi.mocked(busy.setBusy)).toHaveBeenCalledWith(true);
    fireEvent.change(within(sheet()).getByLabelText(de.lists.fields.title), {
      target: { value: 'Regal' },
    });
    fireEvent.click(within(sheet()).getByRole('radio', { name: de.lists.priorityLabel.high }));
    const effort = within(sheet()).getByLabelText(de.lists.fields.effort);
    expect(effort).toHaveAttribute('inputmode', 'decimal');
    fireEvent.change(effort, { target: { value: '1,5' } });
    fireEvent.change(within(sheet()).getByLabelText(de.lists.fields.prerequisite), {
      target: { value: 'Schrauben' },
    });
    fireEvent.click(within(sheet()).getByRole('button', { name: de.lists.add }));
    expect(spies.addTodo).toHaveBeenCalledWith({
      title: 'Regal',
      categoryId: 'buero',
      priority: 'high',
      effortHours: 1.5,
      prerequisite: 'Schrauben',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(vi.mocked(busy.setBusy)).toHaveBeenLastCalledWith(false);
  });

  it('names the field when the title is missing or the effort is not in half hours', () => {
    const { spies } = show();
    open();
    fireEvent.click(within(sheet()).getByRole('button', { name: de.lists.add }));
    expect(within(sheet()).getByText(de.lists.errors.titleRequired)).toBeInTheDocument();
    fireEvent.change(within(sheet()).getByLabelText(de.lists.fields.title), {
      target: { value: 'Regal' },
    });
    fireEvent.change(within(sheet()).getByLabelText(de.lists.fields.effort), {
      target: { value: '0,3' },
    });
    fireEvent.click(within(sheet()).getByRole('button', { name: de.lists.add }));
    expect(within(sheet()).getByText(de.lists.errors.effort)).toBeInTheDocument();
    expect(spies.addTodo).not.toHaveBeenCalled();
  });

  it('cancels without changes and releases the draft guard', () => {
    const { spies, busy } = show();
    open();
    fireEvent.click(within(sheet()).getByRole('button', { name: de.lists.cancel }));
    expect(spies.addTodo).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(vi.mocked(busy.setBusy)).toHaveBeenLastCalledWith(false);
  });

  it('edits an existing to-do and sends only the changed fields', () => {
    const { spies } = show();
    fireEvent.click(within(todoSection()).getAllByRole('button', { name: de.lists.editTodo })[0]!);
    const dialog = screen.getByRole('dialog', { name: de.lists.editTodo });
    expect(within(dialog).getByLabelText(de.lists.fields.title)).toHaveValue(
      'Verkabelung Schreibtisch',
    );
    fireEvent.change(within(dialog).getByLabelText(de.lists.fields.effort), {
      target: { value: '2' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: de.lists.save }));
    expect(spies.patch).toHaveBeenCalledWith(state.todos[0]!.id, { effortHours: 2 });
  });

  it('removes from the edit sheet', () => {
    const { spies } = show();
    fireEvent.click(within(todoSection()).getAllByRole('button', { name: de.lists.editTodo })[0]!);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: de.lists.remove }),
    );
    expect(spies.remove).toHaveBeenCalledWith(state.todos[0]!.id);
  });

  it('sizes the panel with the visual viewport on the wall tablet and keeps the buttons visible', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { height: 420, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    });
    show({ layout: 'wall' });
    open();
    const panel = sheet();
    expect(panel.style.maxHeight).toBe('420px');
    expect(within(panel).getByRole('button', { name: de.lists.add })).toBeVisible();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
  });
});

describe('ListsEditor priority, undo and categories', () => {
  it('opens a chooser with Hoch, Mittel and Niedrig when the mark is tapped and changes the priority', () => {
    const { spies } = show();
    const row = within(todoSection()).getAllByTestId('editor-row')[0]!;
    fireEvent.click(within(row).getByRole('button', { name: new RegExp(de.lists.priority.high) }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(3);
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: de.lists.priorityLabel.low }));
    expect(spies.patch).toHaveBeenCalledWith(state.todos[0]!.id, { priority: 'low' });
  });

  it('offers undo for 8 seconds after removing an entry and restores it', () => {
    const { spies } = show();
    fireEvent.click(
      within(shoppingSection()).getAllByRole('button', { name: new RegExp(de.lists.remove) })[0]!,
    );
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent(de.lists.removed);
    fireEvent.click(within(toast).getByRole('button', { name: de.lists.undo }));
    expect(spies.restore).toHaveBeenCalledWith(state.shopping[0]!.id);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(
      within(shoppingSection()).getAllByRole('button', { name: new RegExp(de.lists.remove) })[0]!,
    );
    act(() => void vi.advanceTimersByTime(8_000));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('adds, renames and removes categories in the manager and says how many to-dos move', () => {
    const { spies } = show();
    fireEvent.click(screen.getByRole('button', { name: de.lists.manageCategories }));
    const manager = screen.getByRole('dialog', { name: de.lists.manageCategories });
    fireEvent.change(within(manager).getByLabelText(de.lists.categoryNew), {
      target: { value: 'Garten' },
    });
    fireEvent.submit(within(manager).getByLabelText(de.lists.categoryNew).closest('form')!);
    expect(spies.addCategory).toHaveBeenCalledWith('Garten');
    const buero = within(manager).getByTestId('category-buero');
    fireEvent.change(within(buero).getByRole('textbox'), { target: { value: 'Arbeitszimmer' } });
    fireEvent.blur(within(buero).getByRole('textbox'));
    expect(spies.renameCategory).toHaveBeenCalledWith('buero', 'Arbeitszimmer');
    fireEvent.click(within(buero).getByRole('button', { name: de.lists.remove }));
    expect(within(manager).getByText('1 offene To-dos wandern nach Sonstiges')).toBeInTheDocument();
    fireEvent.click(within(manager).getByRole('button', { name: de.lists.confirmRemove }));
    expect(spies.removeCategory).toHaveBeenCalledWith('buero');
    expect(within(manager).queryByTestId('category-sonstiges')?.querySelector('button')).toBeNull();
  });

  it('shows a calm message for a rejected change and lets the user dismiss it', () => {
    const view = viewOf((value) => {
      value.notice = { code: 'CATEGORY_NAME_TAKEN', opId: 'x' };
    });
    const { spies } = show({ view });
    expect(screen.getByRole('alert')).toHaveTextContent(de.lists.errors.codes.CATEGORY_NAME_TAKEN);
    fireEvent.click(
      within(screen.getByRole('alert')).getByRole('button', { name: de.lists.dismiss }),
    );
    expect(spies.dismissNotice).toHaveBeenCalled();
  });
});

describe('ListsEditor stability and texts', () => {
  it('holds incoming states while a sheet is open or a field has focus', () => {
    const { spies } = show();
    fireEvent.focus(within(shoppingSection()).getByRole('textbox'));
    expect(spies.setHold).toHaveBeenLastCalledWith(true);
    fireEvent.blur(within(shoppingSection()).getByRole('textbox'));
    expect(spies.setHold).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: de.lists.addTodo }));
    expect(spies.setHold).toHaveBeenLastCalledWith(true);
  });

  it('keeps the typed text when the view updates', () => {
    const { controller } = makeController();
    const ui = (next: ListsController) => (
      <I18nextProvider i18n={i18n}>
        <ListsContext.Provider value={next}>
          <ListsEditor layout="phone" />
        </ListsContext.Provider>
      </I18nextProvider>
    );
    const first = render(ui(controller));
    fireEvent.change(within(shoppingSection()).getByRole('textbox'), { target: { value: 'Teil' } });
    first.rerender(
      ui({
        ...controller,
        view: viewOf((value) => {
          value.rev += 1;
        }),
      }),
    );
    expect(within(shoppingSection()).getByRole('textbox')).toHaveValue('Teil');
  });

  it('renders with dictionary text only', () => {
    const pseudo = JSON.parse(JSON.stringify(de), (_key, value) =>
      typeof value === 'string' ? `§${value}` : value,
    );
    show({ instance: createI18n(pseudo, 'xx') });
    expect(screen.getByRole('region', { name: `§${de.lists.shopping}` })).toBeInTheDocument();
  });
});
