/**
 * Search, filter and sort for roster tables, in the browser. Shared by the
 * staff view and the edit form; each passes its own way of reading a row.
 *
 * Kept free of server imports, like `./time`, because it ships to the page.
 *
 * Rows are hidden with `hidden` and reordered within their own `<tbody>`, so
 * nothing is ever removed: in the edit form every row still submits, and each
 * field's name carries its row index, so DOM order does not matter to the
 * server. The server already renders name A–Z, so nothing runs until the
 * controls are used.
 */

export interface RowData {
  name: string;
  role: string;
  /** Location id, '' when not placed. */
  location: string;
  locationName: string;
}

export interface ListFilterOptions {
  /** Each group (a `<tbody>`) is filtered and sorted on its own. */
  groups: HTMLElement[];
  /** Reads what the filter needs from one `[data-emp-row]` row. */
  read: (row: HTMLElement) => RowData;
  /** After each pass, with how many of the group's rows are showing — e.g. to hide an emptied section. */
  onGroupUpdate?: (group: HTMLElement, visible: number) => void;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** Blank values sort last, so unplaced people and missing positions sink to the bottom. */
function compareText(a: string, b: string): number {
  if (!a !== !b) return a ? -1 : 1;
  return collator.compare(a, b);
}

const SORTS: Record<string, (a: RowData, b: RowData) => number> = {
  name: (a, b) => compareText(a.name, b.name),
  'name-desc': (a, b) => compareText(b.name, a.name),
  role: (a, b) => compareText(a.role, b.role) || compareText(a.name, b.name),
  location: (a, b) => compareText(a.locationName, b.locationName) || compareText(a.name, b.name),
};

export function initListFilter(toolbar: HTMLElement, { groups, read, onGroupUpdate }: ListFilterOptions): void {
  const field = <T extends HTMLElement>(key: string) => toolbar.querySelector<T>(`[data-filter="${key}"]`);
  const search = field<HTMLInputElement>('search');
  const location = field<HTMLSelectElement>('location');
  const role = field<HTMLSelectElement>('role');
  const sort = field<HTMLSelectElement>('sort');
  const countEl = toolbar.querySelector<HTMLElement>('[data-filter-count]');

  function update() {
    const query = search?.value.trim().toLocaleLowerCase('en') ?? '';
    const wantLocation = location?.value ?? '';
    const wantRole = role?.value ?? '';
    const compare = SORTS[sort?.value ?? 'name'] ?? SORTS.name!;
    const filtered = Boolean(query || wantLocation || wantRole);

    let total = 0;
    let shown = 0;

    for (const group of groups) {
      const rows = [...group.querySelectorAll<HTMLElement>(':scope > [data-emp-row]')].map((el) => ({ el, data: read(el) }));
      let visible = 0;

      for (const { el, data } of rows) {
        const match =
          (!query || data.name.toLocaleLowerCase('en').includes(query)) &&
          (!wantLocation || data.location === wantLocation) &&
          (!wantRole || collator.compare(data.role, wantRole) === 0);
        el.hidden = !match;
        if (match) visible++;
      }

      rows.sort((a, b) => compare(a.data, b.data));
      group.append(...rows.map((r) => r.el));

      const noMatches = group.querySelector<HTMLElement>(':scope > [data-no-matches]');
      if (noMatches) noMatches.hidden = visible > 0 || rows.length === 0;

      total += rows.length;
      shown += visible;
      onGroupUpdate?.(group, visible);
    }

    if (countEl) {
      countEl.textContent = !filtered
        ? ''
        : shown === 0
          ? 'No one matches these filters.'
          : `Showing ${shown} of ${total} ${total === 1 ? 'person' : 'people'}.`;
    }
  }

  toolbar.addEventListener('input', update);
  toolbar.addEventListener('change', update);
}
