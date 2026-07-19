import { CopyButton } from '@/components/CopyButton'

interface CodeBlockWrapperProps {
  children: React.ReactNode
  rawText: string
}

export function CodeBlockWrapper({ children, rawText }: CodeBlockWrapperProps) {
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10">
        <CopyButton text={rawText} />
      </div>
      {children}
    </div>
  )
}
