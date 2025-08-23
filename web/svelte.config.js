import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter({ pages: 'dist', assets: 'dist', fallback: '200.html' }),
    paths: { base: '' }
  }
};

export default config;
