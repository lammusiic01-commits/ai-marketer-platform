import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Globe2 } from 'lucide-react'
import api from '../../lib/api'

const firstUrl = text => text.match(/https?:\/\/[^\s<>]+/i)?.[0]?.replace(/[),.!?;:]+$/, '') || ''

export default function LinkPreview({ text }) {
  const url = firstUrl(text)
  const { data } = useQuery({
    queryKey: ['chat-link-preview', url],
    queryFn: async () => (await api.get('/chats/link-preview', { params: { url } })).data,
    enabled: Boolean(url),
    staleTime: 10 * 60 * 1000,
    retry: 0,
  })
  if (!url) return null
  const title = data?.title || new URL(url).hostname
  const description = data?.description
  return (
    <a className="link-preview-card" href={url} target="_blank" rel="noopener noreferrer">
      {data?.image ? <img src={data.image} alt="" loading="lazy" /> : <span className="link-preview-mark"><Globe2 size={18} /></span>}
      <span className="link-preview-copy"><small>{data?.site_name || new URL(url).hostname}</small><b>{title}</b>{description && <span>{description}</span>}<em>{new URL(url).hostname}<ArrowUpRight size={12} /></em></span>
    </a>
  )
}
