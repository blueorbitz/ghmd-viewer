import { useState } from 'react'
import type { FileTreeNode } from '@/types/app'

export interface SidebarProps {
  fileTree: FileTreeNode[]
  activeFilePath: string | null
  onFileSelect: (filePath: string) => void
  isLoading: boolean
}

/**
 * Sidebar — Displays a tree of markdown files for navigation.
 * Includes responsive behavior: visible on desktop (≥768px), hamburger toggle on mobile.
 */
export function Sidebar({ fileTree, activeFilePath, onFileSelect, isLoading }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleFileSelect = (filePath: string) => {
    onFileSelect(filePath)
    setMobileOpen(false)
  }

  const sidebarContent = (
    <SidebarContent
      fileTree={fileTree}
      activeFilePath={activeFilePath}
      onFileSelect={handleFileSelect}
      isLoading={isLoading}
    />
  )

  return (
    <>
      {/* Hamburger button for mobile */}
      <button
        className="fixed top-14 left-2 z-50 md:hidden p-2 rounded-md bg-background border border-border shadow-sm"
        onClick={() => setMobileOpen(true)}
        aria-label="Open file navigation"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {/* Desktop sidebar — always visible on md+ */}
      <aside
        className="hidden md:block w-64 border-r border-border bg-background overflow-y-auto shrink-0"
        aria-label="File sidebar"
        role="complementary"
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar — slide-in panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border shadow-lg overflow-y-auto transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="File sidebar"
        role="complementary"
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-sm font-medium">Files</span>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close file navigation"
            className="p-1 rounded hover:bg-muted"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Backdrop overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}

interface SidebarContentProps {
  fileTree: FileTreeNode[]
  activeFilePath: string | null
  onFileSelect: (filePath: string) => void
  isLoading: boolean
}

function SidebarContent({ fileTree, activeFilePath, onFileSelect, isLoading }: SidebarContentProps) {
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75" strokeLinecap="round" />
          </svg>
          <span>Discovering files…</span>
        </div>
      </div>
    )
  }

  if (fileTree.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">No supported files found</p>
      </div>
    )
  }

  return (
    <nav className="p-2">
      <FileTreeList nodes={fileTree} activeFilePath={activeFilePath} onFileSelect={onFileSelect} depth={0} />
    </nav>
  )
}

interface FileTreeListProps {
  nodes: FileTreeNode[]
  activeFilePath: string | null
  onFileSelect: (filePath: string) => void
  depth: number
}

function FileTreeList({ nodes, activeFilePath, onFileSelect, depth }: FileTreeListProps) {
  return (
    <ul className="space-y-0.5" role="tree">
      {nodes.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          activeFilePath={activeFilePath}
          onFileSelect={onFileSelect}
          depth={depth}
        />
      ))}
    </ul>
  )
}

/** Displays a small icon indicating the file type (PDF or Markdown). */
function FileTypeIcon({ fileType }: { fileType?: 'markdown' | 'pdf' }) {
  if (fileType === 'pdf') {
    return (
      <svg
        className="h-4 w-4 shrink-0 text-red-500/70"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="1" width="12" height="14" rx="1" />
        <text
          x="8"
          y="10.5"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize="5"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          PDF
        </text>
      </svg>
    )
  }

  // Default: Markdown icon
  return (
    <svg
      className="h-4 w-4 shrink-0 text-blue-500/70"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="1" width="12" height="14" rx="1" />
      <text
        x="8"
        y="10.5"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="6"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
      >
        M
      </text>
    </svg>
  )
}

interface FileTreeItemProps {
  node: FileTreeNode
  activeFilePath: string | null
  onFileSelect: (filePath: string) => void
  depth: number
}

function FileTreeItem({ node, activeFilePath, onFileSelect, depth }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(false)
  const paddingLeft = `${depth * 12 + 8}px`
  const isActive = node.path === activeFilePath

  if (node.type === 'file') {
    return (
      <li role="treeitem">
        <button
          className={`w-full text-left text-sm px-2 py-1 rounded transition-colors truncate flex items-center gap-1.5 ${
            isActive
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-foreground hover:bg-muted'
          }`}
          style={{ paddingLeft }}
          onClick={() => onFileSelect(node.path)}
          aria-current={isActive ? 'page' : undefined}
          title={node.name}
        >
          <FileTypeIcon fileType={node.fileType} />
          <span className="truncate">{node.name}</span>
        </button>
      </li>
    )
  }

  // Directory node — collapsible
  return (
    <li role="treeitem" aria-expanded={expanded}>
      <button
        className="w-full text-left text-sm font-medium text-muted-foreground px-2 py-1 rounded hover:bg-muted transition-colors truncate flex items-center gap-1"
        style={{ paddingLeft }}
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? `Collapse folder ${node.name}` : `Expand folder ${node.name}`}
        title={node.name}
      >
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && node.children && node.children.length > 0 && (
        <FileTreeList
          nodes={node.children}
          activeFilePath={activeFilePath}
          onFileSelect={onFileSelect}
          depth={depth + 1}
        />
      )}
    </li>
  )
}
