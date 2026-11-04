import { WorkspaceRequestError } from '../workspace/request'
import { FILE_SEARCH_UNAVAILABLE } from './messages'

/** A call the person can correct, such as a search that is too long. */
export class EmbeddingRequestError extends WorkspaceRequestError {}

/** The embeddings endpoint did not answer. No secret is included. */
export class EmbeddingUnavailableError extends Error {
  constructor() {
    super(FILE_SEARCH_UNAVAILABLE)
    this.name = 'EmbeddingUnavailableError'
  }
}

/** The named file is not in this library or matter. */
export class IndexedFileMissingError extends Error {
  constructor() {
    super('File not found.')
    this.name = 'IndexedFileMissingError'
  }
}
