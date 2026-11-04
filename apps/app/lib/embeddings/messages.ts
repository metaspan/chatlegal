/**
 * Citizen copy for prepared file search.
 * The same sentences are used by the API and the library / matter panes.
 * Nothing here is a solicitor's note.
 */

export const FILE_SEARCH_OFF = 'Search across the words in your files is turned off.'
export const FILE_SEARCH_READY = 'Search across the words in your files is ready.'
export const FILE_SEARCH_EMPTY = 'Nothing in your files has been prepared for search yet.'
export const FILE_SEARCH_NO_MATCH = 'Nothing in your files matches that.'
export const FILE_SEARCH_PREPARED = 'Those files are ready to search.'
export const FILE_SEARCH_UNAVAILABLE = 'Search could not prepare your files just now.'
export const FILE_SEARCH_UNREADABLE = 'Search could not read the words in this file.'
export const FILE_SEARCH_NOT_TEXT = 'Search reads text, Markdown, PDF, and Word files.'
export const FILE_SEARCH_EMPTY_FILE = 'This file has no words to search.'
export const FILE_SEARCH_LONG = 'Only the first part of this file was prepared.'
export const FILE_SEARCH_DIMENSION = 'Search was prepared for a different model. It was left as it is.'
export const FILE_SEARCH_QUERY_LONG = 'Use a shorter search.'
export const FILE_SEARCH_FAILED = 'Search could not use your files just now.'

/** How many files one prepare call will read. The rest wait for another call. */
export const FILE_SEARCH_FILE_CAP = 50
export const FILE_SEARCH_CAP = 'Search prepared the first 50 files.'
