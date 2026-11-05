import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '../../lib/supabase'

const SIZES = { sm: 'size-10 text-base', md: 'size-14 text-xl', lg: 'size-24 text-4xl' }

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? `${words[0]?.[0]}${words[1]?.[0]}` : (words[0]?.slice(0, 2) ?? '?')).toUpperCase()
}

/** A real photo if there is one, otherwise generated initials in brand style. */
export function UserAvatar({ path, name, size = 'sm' }: { path: string | null; name: string; size?: keyof typeof SIZES }) {
  const { data: url } = useQuery({
    queryKey: ['avatarUrl', path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await getSupabase().storage.from('avatars').createSignedUrl(path!, 60 * 60)
      if (error) throw error
      return data.signedUrl
    },
  })

  if (url) return <img src={url} alt="" className={`${SIZES[size]} shrink-0 rounded-full object-cover`} />
  return (
    <span aria-hidden className={`${SIZES[size]} brand-offset font-display grid shrink-0 place-items-center rounded-full bg-surface-2`}>
      {initialsOf(name)}
    </span>
  )
}
