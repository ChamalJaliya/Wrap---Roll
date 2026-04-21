//@ts-check

const path = require('path');
const { loadEnvConfig } = require('@next/env');
// Ensure apps/client/.env.local is loaded when Nx runs `next dev` with cwd = monorepo root
loadEnvConfig(path.join(__dirname));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  /**
   * API to Nest: one path only — browser calls same-origin `/api/nest/*` (see `services/api.ts`).
   * Next proxies here (including OPTIONS preflight). Do not add `app/api/nest/...` routes on
   * this app or they override these rewrites and break auth headers / CORS handshakes.
   * Server-side only: target Nest base URL including `/api`. Required in hosted prod so the
   * Node server can reach your API (private URL is fine, e.g. internal service or `http://api:4000/api`).
   */
  async rewrites() {
    return [
      {
        source: '/api/nest/:path*',
        destination: `${process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000/api'}/:path*`,
      },
    ];
  },
};

const plugins = [
  withNx,
  withNextIntl,
];

module.exports = composePlugins(...plugins)(nextConfig);
