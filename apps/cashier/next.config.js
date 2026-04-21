const { composePlugins, withNx } = require('@nx/next');
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  register: true,
  // Keep PWA off by default to avoid stale SW asset caches
  // during rapid cashier UI iteration. Opt-in via ENABLE_CASHIER_PWA=true.
  disable: process.env.ENABLE_CASHIER_PWA !== 'true',
});

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
};

const plugins = [
  withNx,
];

module.exports = composePlugins(...plugins)(withPWA(nextConfig));
