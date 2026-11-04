/**
 * Content-Type for a library or matter file served to the right-pane viewer.
 * The name is already a single safe segment. Unknown types are plain text.
 */

export function workspaceContentType(name: string): string {
  const base = name.trim().split(/[/\\]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  const ext = dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
  switch (ext) {
    case 'md':
    case 'markdown':
      return 'text/markdown; charset=utf-8'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    case 'avif':
      return 'image/avif'
    case 'pdf':
      return 'application/pdf'
    default:
      return 'text/plain; charset=utf-8'
  }
}
