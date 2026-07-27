export function runSeedMain(
  main: () => Promise<void>,
  disconnect?: () => Promise<void>,
  fileMarker?: string,
) {
  const entry = (process.argv[1] ?? '').replace(/\\/g, '/');
  const shouldRun =
    require.main === module || (fileMarker !== undefined && entry.includes(fileMarker));

  if (!shouldRun) {
    return;
  }

  main()
    .catch(console.error)
    .finally(async () => {
      if (disconnect) {
        await disconnect();
      }
    });
}
