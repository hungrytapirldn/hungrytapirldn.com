/**
 * About Us Page
 */
import type { DataFunctionArgs, V2_MetaArgs } from '@remix-run/cloudflare';
import { redirect } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';

import type { loader as rootLoader } from '~/root';
import { MarkdownContent } from '~/components/markdown-content';
import type { ContentStoreGeneralEntry } from '~/server/entities/content';
import { isProd } from '~/utils/misc';
import { getSeoMetas } from '~/utils/seo';

export function meta({ matches, location, data }: V2_MetaArgs<typeof loader, { root: typeof rootLoader }>) {
  const hostUrl = matches.find((match) => match.id === 'root')?.data?.hostUrl as string;
  return getSeoMetas({
    url: hostUrl + location.pathname,
    title: 'About Us | Hungry Tapir',
    // description: data?.metadata?.description, TODO SEO Description
  });
}

export async function loader({ context }: DataFunctionArgs) {
  try {
    return context.services.content.getGeneralEntry('about-us');
  } catch (error) {
    console.error(error); // TODO Sentry badlink
    if (isProd(context)) return redirect('/404');
    else return {};
  }
}

export default function AboutUs() {
  const pageData = useLoaderData<ContentStoreGeneralEntry>();

  return <MarkdownContent data={pageData.data.general} />;
}
