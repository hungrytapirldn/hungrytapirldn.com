import { logDevReady } from '@remix-run/cloudflare';
import { createPagesFunctionHandler, type createRequestHandler } from '@remix-run/cloudflare-pages';
import * as Sentry from '@sentry/remix';
import { getClientIPAddress } from 'remix-utils';
import { Stripe as StripeApi } from 'stripe';

import * as build from '@remix-run/dev/server-build';
import type { HTEnv } from 'types/ht-context';
import type { CartFlashData, CartSessionData } from '~/server/entities/cart';
import { allContentTypes } from '~/server/entities/content';
import { ContentKv } from '~/server/repositories/content-kv';
import { Notion, type TypeToDbMap } from '~/server/repositories/notion';
import { SessionKv } from '~/server/repositories/session-kv';
import { Cart } from '~/server/services/cart';
import { ApiAuth } from '~/server/services/api-auth';
import { Stripe } from '~/server/services/stripe';
import { ImageKit } from '~/server/repositories/imagekit';
import { Image } from '~/server/services/image';
import { Content } from '~/server/services/content';
import { ApiRefresh } from './server/services/api-refresh';
import { EnvSchema } from './server/env';
import { ConversionDispatcher } from './server/services/conversion-dispatcher';

let remixHandler: ReturnType<typeof createRequestHandler>;

// console.log(process);
// if (process.env.NODE_ENV === 'DEV') {
logDevReady(build);
// }

export const onRequest: PagesFunction<HTEnv> = async (context) => {
  try {
    if (context.env.SENTRY_DSN) {
      Sentry.init({
        debug: context.env.SENTRY_DEBUG,
        dsn: context.env.SENTRY_DSN,
        environment: context.env.SENTRY_ENV,
        integrations: [],
        // eslint-disable-next-line no-useless-escape
        // prettier-ignore
        tracePropagationTargets: ['/^https:\/\/www\.hungrytapirldn\.com/', '/^.*.hungrytapir-store\.pages\.dev/', 'localhost', /^\//],
        tracesSampleRate: context.env.SENTRY_TRACES_SAMPLE_RATE,
        beforeSend(event) {
          if (event.request?.url?.includes('sentry')) return null;
          event.user = {};

          let ip = getClientIPAddress(context.request.headers);
          if (ip) event.user.ip_address = ip;

          return event;
        },
      });
    }

    const env = EnvSchema.parse(context.env);

    // Initialize repositories
    const contentKv = new ContentKv(env.CONTENT_STORE, env.CACHE_TTL_DAYS);
    const repos = {
      notion: new Notion(
        env.NODE_ENV,
        env.NOTION_API_SECRET,
        allContentTypes().reduce(
          (acc, type) => ((acc[type] = env[`NOTION_API_DB_${type.toUpperCase()}` as keyof HTEnv] as string), acc),
          {} as TypeToDbMap,
        ),
      ),
      contentKv: contentKv,
    };

    // Initialize services

    // Cart service relies on session service to be commited after each request
    const sessionKv = new SessionKv<CartSessionData, CartFlashData>(
      '__session',
      env.SESSION_STORE,
      env.SESSION_SECRET,
      env.HOST_URL,
      env.NODE_ENV,
    );
    const cart = new Cart(sessionKv);
    await cart.init(context.request);

    // ImageKit
    const image = new Image(new ImageKit(env.IMAGEKIT_PRIVATE_KEY, env.IMAGEKIT_PUBLIC_KEY));

    // Content Store
    const content = new Content(contentKv);

    // Combine services
    const services = {
      cart: cart,
      apiAuth: new ApiAuth(env.BASIC_AUTH_USERNAME, env.BASIC_AUTH_PASSWORD),
      stripe: new Stripe(
        env.NODE_ENV === 'PROD',
        env.HOST_URL,
        new StripeApi(env.STRIPE_SECRET_KEY, {
          apiVersion: '2022-11-15',
          typescript: true,
        }),
        cart,
        content,
      ),
      content,
      apiRefresh: new ApiRefresh(env.NODE_ENV === 'PROD', image, repos.contentKv, repos.notion),
      dispatcher: new ConversionDispatcher(env.NODE_ENV === 'DEV', env.CONVERSION_DISPATCHER_QUEUE, cart, content),
    };

    // Get response from Remix
    if (!remixHandler) {
      remixHandler = createPagesFunctionHandler({
        build,
        mode: env.NODE_ENV === 'DEV' ? 'development' : env.NODE_ENV === 'TEST' ? 'test' : 'production',
        getLoadContext() {
          return { env, repos, services };
        },
      });
    }

    let response = await remixHandler(context);

    // Commit session to KV store
    response.headers.append('Set-Cookie', await cart.commit());

    // Return response
    return response;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
};
