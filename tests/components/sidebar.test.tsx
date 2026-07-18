import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from '@/components/Sidebar'
import type { FileTreeNode } from '@/types/app'

const mockDirectoryExpand = vi.fn().mockResolvedValue([])

const mockTree: FileTreeNode[] = [
  { name: 'README.md', path: 'README.md', type: 'file' },
  {
    name: 'docs',
    path: 'docs',
    type: 'directory',
    loaded: true,
    children: [
      { name: 'guide.md', path: 'docs/guide.md', type: 'file' },
      { name: 'api.md', path: 'docs/api.md', type: 'file' },
    ],
  },
  { name: 'CHANGELOG.md', path: 'CHANGELOG.md', type: 'file' },
]

describe('Sidebar', () => {
  it('renders file tree with files and folders', () => {
    render(
      <Sidebar
        fileTree={mockTree}
        activeFilePath={null}
        onFileSelect={() => {}}
        onDirectoryExpand={mockDirectoryExpand}
        isLoading={false}
      />,
    )

    expect(screen.getAllByText('README.md').length).toBeGreaterThan(0)
    expect(screen.getAllByText('docs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('CHANGELOG.md').length).toBeGreaterThan(0)
  })

  it('shows loading state', () => {
    render(
      <Sidebar
        fileTree={[]}
        activeFilePath={null}
        onFileSelect={() => {}}
        onDirectoryExpand={mockDirectoryExpand}
        isLoading={true}
      />,
    )

    expect(screen.getAllByText('Discovering files…').length).toBeGreaterThan(0)
  })

  it('shows empty state when no files found', () => {
    render(
      <Sidebar
        fileTree={[]}
        activeFilePath={null}
        onFileSelect={() => {}}
        onDirectoryExpand={mockDirectoryExpand}
        isLoading={false}
      />,
    )

    expect(screen.getAllByText('No supported files found').length).toBeGreaterThan(0)
  })

  it('expands and collapses folders on click', () => {
    render(
      <Sidebar
        fileTree={mockTree}
        activeFilePath={null}
        onFileSelect={() => {}}
        onDirectoryExpand={mockDirectoryExpand}
        isLoading={false}
      />,
    )

    // Initially, folder children are not visible (collapsed)
    expect(screen.queryByText('guide.md')).not.toBeInTheDocument()

    // Click folder to expand
    const folderButtons = screen.getAllByRole('button', { name: /expand folder docs/i })
    fireEvent.click(folderButtons[0])

    // Children should now be visible
    expect(screen.getAllByText('guide.md').length).toBeGreaterThan(0)
    expect(screen.getAllByText('api.md').length).toBeGreaterThan(0)

    // Click folder again to collapse
    const collapseButtons = screen.getAllByRole('button', { name: /collapse folder docs/i })
    fireEvent.click(collapseButtons[0])

    expect(screen.queryByText('guide.md')).not.toBeInTheDocument()
  })

  it('calls onFileSelect when a file is clicked', () => {
    const onFileSelect = vi.fn()

    render(
      <Sidebar
        fileTree={mockTree}
        activeFilePath={null}
        onFileSelect={onFileSelect}
        onDirectoryExpand={mockDirectoryExpand}
        isLoading={false}
      />,
    )

    const readmeButtons = screen.getAllByText('README.md')
    fireEvent.click(readmeButtons[0])

    expect(onFileSelect).toHaveBeenCalledWith('README.md')
  })

  it('highlights the active file with bg-accent', () => {
    render(
      <Sidebar
        fileTree={mockTree}
        activeFilePath="README.md"
        onFileSelect={() => {}}
        onDirectoryExpand={mockDirectoryExpand}
        isLoading={false}
      />,
    )

    // The active file button should have aria-current="page"
    const activeButtons = screen.getAllByRole('button', { current: 'page' })
    expect(activeButtons.length).toBeGreaterThan(0)
    expect(activeButtons[0]).toHaveClass('bg-accent')
  })

  it('renders hamburger menu button for mobile', () => {
    render(
      <Sidebar
        fileTree={mockTree}
        activeFilePath={null}
        onFileSelect={() => {}}
        onDirectoryExpand={mockDirectoryExpand}
        isLoading={false}
      />,
    )

    const menuButton = screen.getByRole('button', { name: /open file navigation/i })
    expect(menuButton).toBeInTheDocument()
  })

  it('opens mobile sidebar when hamburger is clicked', () => {
    render(
      <Sidebar
        fileTree={mockTree}
        activeFilePath={null}
        onFileSelect={() => {}}
        onDirectoryExpand={mockDirectoryExpand}
        isLoading={false}
      />,
    )

    const menuButton = screen.getByRole('button', { name: /open file navigation/i })
    fireEvent.click(menuButton)

    // Close button should now be visible
    const closeButton = screen.getByRole('button', { name: /close file navigation/i })
    expect(closeButton).toBeInTheDocument()
  })

  it('closes mobile sidebar when close button is clicked', () => {
    render(
      <Sidebar
        fileTree={mockTree}
        activeFilePath={null}
        onFileSelect={() => {}}
        onDirectoryExpand={mockDirectoryExpand}
        isLoading={false}
      />,
    )

    // Open
    const menuButton = screen.getByRole('button', { name: /open file navigation/i })
    fireEvent.click(menuButton)

    // Close
    const closeButton = screen.getByRole('button', { name: /close file navigation/i })
    fireEvent.click(closeButton)

    // The mobile sidebar should have -translate-x-full (hidden)
    const mobileSidebars = screen.getAllByRole('complementary', { name: /file sidebar/i })
    const mobileSidebar = mobileSidebars.find((el) => el.classList.contains('fixed'))
    expect(mobileSidebar).toHaveClass('-translate-x-full')
  })

  it('closes mobile sidebar when a file is selected', () => {
    const onFileSelect = vi.fn()

    render(
      <Sidebar
        fileTree={mockTree}
        activeFilePath={null}
        onFileSelect={onFileSelect}
        onDirectoryExpand={mockDirectoryExpand}
        isLoading={false}
      />,
    )

    // Open mobile sidebar
    const menuButton = screen.getByRole('button', { name: /open file navigation/i })
    fireEvent.click(menuButton)

    // Click a file
    const readmeButtons = screen.getAllByText('README.md')
    fireEvent.click(readmeButtons[0])

    expect(onFileSelect).toHaveBeenCalledWith('README.md')

    // Mobile sidebar should close
    const mobileSidebars = screen.getAllByRole('complementary', { name: /file sidebar/i })
    const mobileSidebar = mobileSidebars.find((el) => el.classList.contains('fixed'))
    expect(mobileSidebar).toHaveClass('-translate-x-full')
  })
})
