/**
 * Blog page
 */

import { redirect } from '@remix-run/cloudflare';
import { Link, useLoaderData, useMatches } from '@remix-run/react';
import { isProd } from '~/utils/misc';
import type { HTActionArgs } from '~/utils/types';
import type { ContentStoreEntry } from '~/services/content-store';
import { getBlog, validateRequest } from '~/services/content-store';
import { ArrowLeft } from 'lucide-react';

// Fetch blog data content-store
export async function loader({
    request: { url },
    context,
    params,
}: HTActionArgs) {
    try {
        const urlPath = validateRequest(new URL(url));
        const result = await getBlog(context, urlPath.slug);
        console.log(`result ${JSON.stringify(context)}`);
        if (!result || !result.entryExists) {
            throw new Error('Entry not found');
        }
        return result;
    } catch (error) {
        console.error(error); // TODO badlink
        if (isProd(context)) return redirect('/404');
    }
    return null;
}

export default function Blog() {
    const matches = useMatches();
    const loaderData =
        matches.find((element: any) => element.id === 'routes/blog')?.data ??
        [];
    const hostUrl = loaderData.host as string;

    const blogData = useLoaderData<ContentStoreEntry>();
    if (!blogData || !blogData.data) return null;
    const blog = blogData.data.blog;

    return (
        <div className="flex flex-col">
            <div className="content-wrapper bg-ht-peach">
                <div className="content-container">
                    <div className="title-section flex flex-col">
                        <Link to={`${hostUrl}/blog`} className="text-base">
                            <ArrowLeft className="inline" /> Back to Blogs
                        </Link>
                        <h1 className="title text-center">
                            {blog.Post.title[0].text.content}
                        </h1>
                    </div>
                </div>
            </div>
            <div className="content-wrapper">
                <div className="content-container mt-4">
                    <div className="prose prose-lg">
                        {blog.Content.rich_text.map((line) => {
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: line.text.content,
                                }}
                            />;
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
