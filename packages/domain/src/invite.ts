// An invitation is a secret token (24 random bytes, base64url = 32 characters) shown once to the owner.
// The app shares it as a link; whoever opens it signs in, sees the space name, then accepts.
const TOKEN = /^[A-Za-z0-9_-]{32}$/;
export function inviteLink(appUrl: string, token: string): string {
  if (!TOKEN.test(token)) throw new TypeError('invalid invitation token');
  return `${appUrl.replace(/#.*$/, '').replace(/\/?$/, '/')}#/join/${token}`;
}
// accepts a full link, a link without the domain, or the bare token; anything else gives null
export function parseInvite(input: string): string | null {
  const s = input.trim();
  const m = /#\/join\/([A-Za-z0-9_-]{32})\/?$/.exec(s) ?? /^([A-Za-z0-9_-]{32})$/.exec(s);
  return m?.[1] ?? null;
}
