export type ThemePreference = 'light' | 'dark' | 'system'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export interface AppError {
  type:
    | 'network'
    | 'not_found'
    | 'rate_limited'
    | 'auth_required'
    | 'auth_failed'
    | 'invalid_url'
    | 'render_error'
    | 'share_expired'
    | 'share_invalid'
  message: string
  retryable: boolean
  action?: 'retry' | 'authenticate' | 'enter_passphrase' | 'new_url'
}
