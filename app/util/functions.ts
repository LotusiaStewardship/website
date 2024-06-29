import type { PageLink } from "@nuxt/ui-pro/types"
import type { PublicRuntimeConfig } from "nuxt/schema"

export function parsePageLinks(
  links: PageLink[],
  urls: PublicRuntimeConfig['url']
) {
  return links?.map(link => {
    const to = link.to as string || ''
    const linkArray = to.toString().split('/')
    const urlProp = linkArray[0]
    // process the link if it contains a placeholder for a config.public.url prop
    if (Object.keys(urls).find(url => urlProp == url)) {
      return {
        ...link,
        to: `${urls[urlProp]}/${linkArray.slice(1).join('/')}`
      } as PageLink
    }
    // return the regular link if no special processing necessary
    return link
  })
}