/**
 * Product page
 */

import { redirect } from '@remix-run/cloudflare';
import type { V2_MetaArgs } from '@remix-run/react';
import { useLoaderData } from '@remix-run/react';
import { isProd } from '~/utils/misc';
import type { HTActionArgs } from '~/utils/types';
import type { ContentStoreProductEntry } from '~/services/content-store';
import { getProduct, validateRequest } from '~/services/content-store';
import { AspectRatio } from '@radix-ui/react-aspect-ratio';
import { AddToBag } from '~/components/add-to-bag';
import { getSeoMetas } from '~/utils/seo';
import type { loader as rootLoader } from '~/root';
import { MarkdownContent } from '~/components/markdown-content';

export function meta({ matches, location, data }: V2_MetaArgs<typeof loader, { root: typeof rootLoader }>) {
  const hostUrl = matches.find((match) => match.id === 'root')?.data?.hostUrl as string;
  return getSeoMetas({
    url: hostUrl + location.pathname,
    title: data?.metadata?.title ? data.metadata.title + ' | Hungry Tapir' : undefined,
    // description: data?.metadata?.description, TODO SEO Description
  });
}

export async function loader({ request: { url }, context, params }: HTActionArgs) {
  // Fetch product data content-store
  try {
    const urlPath = validateRequest(new URL(url));
    const result = await getProduct(context, urlPath.slug);
    if (!result) {
      throw new Error('Entry not found');
    }
    return result;
  } catch (error) {
    console.error(error); // TODO badlink
    if (isProd(context)) return redirect('/404');
  }
}

export default function Product() {
  const productData = useLoaderData<ContentStoreProductEntry>();
  if (!productData || !productData.data) return null;
  const productContent = productData.data.product;

  const aspectRatio = 8 / 9;
  console.log(`product ${JSON.stringify(productData)}`);
  return (
    <>
      <div className={'content-wrapper bg-' + productData.data.backgroundColour}>
        <div className='content-container my-24 flex flex-col items-center justify-center py-2'>
          <div className='flex flex-col items-center md:flex-row md:space-x-8'>
            <div className='w-[350px] basis-1/2 overflow-hidden rounded-3xl'>
              <AspectRatio ratio={aspectRatio}>
                <img
                  src={productData.data.primaryImage}
                  alt={productData.data.primaryImageAlt}
                  className='h-full w-full object-cover'
                />
              </AspectRatio>
            </div>
            <div className='items-left mt-5 flex basis-1/2 flex-col justify-center space-y-4 md:w-1/2'>
              <header className='flex flex-row items-end justify-between text-4xl font-extrabold uppercase text-primary sm:text-5xl md:text-6xl'>
                <h1>{productData.metadata.title}</h1>
                <p>£{productData.data.price}</p>
              </header>
              <div className='prose prose-lg max-w-none'>
                <MarkdownContent data={productContent} />
              </div>
              <p className='font-bold'>{productData.data.unit}</p>
              <AddToBag id={productData.data.id} className='text-white' />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
