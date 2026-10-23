/**
 * Class strings shared by the /do-i-work page and its editable rows, so a row
 * cloned in the browser looks exactly like one rendered on the server.
 */
export const inputClass =
  'w-full rounded-lg border border-(--border-strong) bg-(--surface-page) px-2.5 py-1.5 text-sm text-(--text-strong) placeholder:text-(--text-muted) aria-invalid:border-red-600 dark:aria-invalid:border-red-400';

export const sectionTitle = 'text-xl font-bold text-(--text-strong) sm:text-2xl';

/** A heading one level down from `sectionTitle`: an edit-form part or a location's table. */
export const subsectionTitle = 'text-lg font-bold text-(--text-strong)';

export const errorText ='text-xs font-medium text-red-600 dark:text-red-400';

export const removeNewRowClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-full text-(--text-muted) hover:bg-(--surface-sunken) hover:text-(--accent)';

/**
 * Placeholders in the `<template>` rows that "Add" clones. The script swaps
 * them for the next free row index and its 1-based number.
 */
export const ROW_INDEX = '__i__';
export const ROW_NUMBER = '__n__';
