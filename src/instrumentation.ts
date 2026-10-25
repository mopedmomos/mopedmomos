export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initKeepAlive } = await import('./server/keep-alive');
    initKeepAlive();
  }
}
