import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { useViewSettings } from '@/components/ViewSettingsProvider'

export function SettingsDropdown(): JSX.Element {
  const { mermaidEnabled, setMermaidEnabled, rawViewEnabled, setRawViewEnabled } =
    useViewSettings()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Display settings">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Display Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="flex items-center justify-between"
        >
          <label
            htmlFor="mermaid-toggle"
            className="cursor-pointer text-sm"
          >
            Mermaid Diagrams
          </label>
          <Switch
            id="mermaid-toggle"
            checked={mermaidEnabled}
            onCheckedChange={setMermaidEnabled}
          />
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="flex items-center justify-between"
        >
          <label
            htmlFor="raw-view-toggle"
            className="cursor-pointer text-sm"
          >
            Raw Markdown
          </label>
          <Switch
            id="raw-view-toggle"
            checked={rawViewEnabled}
            onCheckedChange={setRawViewEnabled}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
