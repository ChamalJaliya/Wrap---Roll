//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  /**
   * If anything calls `/api/admin/*` instead of the Nest proxy prefix `/api/nest/*`,
   * rewrite so the App Route proxy still reaches Nest (`/api` global prefix + `admin/...`).
   */
  async rewrites() {
    return [{ source: '/api/admin/:path*', destination: '/api/nest/admin/:path*' }];
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
