export async function getUser(): Promise<unknown> {
  const res = await fetch('http://localhost:3001/users/me', {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) return null;
  return res.json() as Promise<unknown>;
}
