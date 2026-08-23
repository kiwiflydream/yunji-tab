import type { CSSProperties } from 'react'
import { PawPrint } from 'lucide-react'
import catCloud05Url from 'url:~assets/cat-doodles/cat-cloud-05.svg'
import catCloud07Url from 'url:~assets/cat-doodles/cat-cloud-07.svg'
import { cn } from '~/lib/utils'

interface CatFaceProps {
  className?: string
}

function maskStyle(url: string): CSSProperties {
  return {
    backgroundColor: 'currentColor',
    maskImage: `url("${url}")`,
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize: 'contain',
    WebkitMaskImage: `url("${url}")`,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
  }
}

export function CatFace({ className }: CatFaceProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('block text-foreground', className)}
      style={maskStyle(catCloud07Url)}
    />
  )
}

export function CatDoodles() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
    >
      <div className="absolute -top-2 right-5 text-border/55 xl:right-10">
        <span
          className="block size-28"
          style={maskStyle(catCloud05Url)}
        />
      </div>

      <div className="absolute bottom-8 right-3 flex rotate-[-18deg] items-center gap-5 text-border/45 xl:right-8">
        <PawPrint className="size-5 rotate-[-12deg]" />
        <PawPrint className="size-6 rotate-[10deg]" />
        <PawPrint className="size-4 rotate-[-5deg]" />
      </div>
    </div>
  )
}
