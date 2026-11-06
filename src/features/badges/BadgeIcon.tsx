import { Award, CalendarDays, Clock, Compass, Disc3, Headphones, Heart, MapPin, ShieldCheck, Star, Users, type LucideIcon } from 'lucide-react'

const GLYPHS: Record<string, LucideIcon> = {
  starter: Star,
  genre: Headphones,
  set_format: Disc3,
  time: Clock,
  season: CalendarDays,
  places: MapPin,
  loyalty: Heart,
  discovery: Compass,
  community: Users,
  verified: ShieldCheck,
  limited: Award,
}

/** Unified placeholder: a monochrome symbol with a red-blue offset, the level as the frame (thin, thick, double). */
export function BadgeIcon({ category, level, size = 56 }: { category: string; level: number; size?: number }) {
  const Glyph = GLYPHS[category] ?? Award
  const earned = level > 0
  return (
    <svg aria-hidden viewBox="0 0 48 48" width={size} height={size} className={`shrink-0 ${earned ? 'text-text-primary' : 'text-text-secondary opacity-50'}`}>
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth={level >= 2 && level !== 3 ? 3 : 1.5} strokeDasharray={earned ? undefined : '3 3'} />
      {level >= 3 && <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {earned && (
        <>
          <Glyph x={13} y={14} width={20} height={20} color="var(--gst-red)" />
          <Glyph x={15} y={14} width={20} height={20} color="var(--gst-blue)" />
        </>
      )}
      <Glyph x={14} y={14} width={20} height={20} color="currentColor" />
    </svg>
  )
}
