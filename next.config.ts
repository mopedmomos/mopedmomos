import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@libsql/client'],
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/orders', destination: '/index.html' },
      { source: '/kitchen', destination: '/kitchen/index.html' },
      { source: '/k/:token', destination: '/kitchen/index.html' }
    ];
  },
  async headers() { return [{ source: '/:path*', headers: [
    {key:'X-Content-Type-Options',value:'nosniff'}, {key:'X-Frame-Options',value:'DENY'},
    {key:'Referrer-Policy',value:'no-referrer'}, {key:'X-Robots-Tag',value:'noindex, nofollow'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
  ] }]; }
};
export default config;
