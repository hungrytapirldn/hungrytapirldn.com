import { type ActionArgs, redirect } from '@remix-run/cloudflare';
import type { RouteMatch } from '@remix-run/react';
import { Outlet, useMatches } from '@remix-run/react';
import type { ContentStoreGeneralEntry } from '~/server/entities/content';
import { isProd } from '~/utils/misc';

export async function loader({ request: { url: requestUrl }, context }: ActionArgs) {
  try {
    const url = new URL(requestUrl);
    const urlPath = url.pathname
      .split('/')
      .filter((x) => x)
      .map((x) => x.toLowerCase());
    if (urlPath.length !== 1) {
      throw new Error('Invalid request');
    }
    const result = await context.services.content.getGeneral(urlPath[0]);
    if (!result) {
      // todo sentry error
      throw new Error('Entry not found');
    }
    return result;
  } catch (error) {
    console.error(error); // TODO badlink
    if (isProd(context)) return redirect('/404');
  }
  return null;
}

export default function GeneralLayout() {
  const matches = useMatches();
  const outletEntry = matches.find((route: RouteMatch) => !new Set(['root', 'routes/_general']).has(route.id));
  if (!outletEntry?.data) throw new Error('Invalid route');
  const outletData: ContentStoreGeneralEntry = outletEntry?.data;

  return (
    <main className='flex min-h-screen flex-col'>
      <header className='content-wrapper bg-ht-orange'>
        <div className='content-container'>
          <div className='title-section text-center'>
            <h1>{outletData.metadata.title}</h1>
          </div>
        </div>
      </header>
      <article className='content-wrapper body-text-wrapper'>
        <div className='content-container mt-4'>
          <Outlet />
        </div>
      </article>
    </main>
  );
}
