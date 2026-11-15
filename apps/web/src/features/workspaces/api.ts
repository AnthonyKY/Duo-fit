// Spaces through the database: reads go through row level security, every change through a database function
// (supabase/migrations/202611140001_collabfit_foundation.sql), which checks who may do what.
import type { WorkspaceMode } from '@collabfit/domain';
import { currentSession, insert, remove, rest, rpc } from '../../shared/backend.ts';
import type { PublicProfile } from '../profile/PhotoOrAvatar.tsx';

export interface Space { id: string; name: string; mode: WorkspaceMode; max_members: number; owner_id: string | null; created_at: string }
export interface Member { user_id: string; role: 'owner' | 'member'; joined_at: string; profile: PublicProfile | null }
export interface Invitation { id: string; max_uses: number; uses: number; expires_at: string }
export interface InvitePreview { workspace_name: string; mode: WorkspaceMode; invited_by: string | null; members: number; max_members: number }

const SPACE = 'id,name,mode,max_members,owner_id,created_at';
const enc = encodeURIComponent;
export const me = () => currentSession()?.user.id ?? '';

export const mySpaces = () => rest<Space[]>(`workspaces?select=${SPACE}&order=created_at.asc`);
export const getSpace = async (id: string) => (await rest<Space[]>(`workspaces?select=${SPACE}&id=eq.${id}`))[0] ?? null;
export async function profilesOf(ids: string[]): Promise<Map<string, PublicProfile>> {
  const list = [...new Set(ids)].filter(Boolean);
  if (!list.length) return new Map();
  const rows = await rest<(PublicProfile & { id: string })[]>(`profiles?select=id,display_name,avatar_seed,avatar_path&id=in.(${list.join(',')})`);
  return new Map(rows.map(r => [r.id, r]));
}
export async function members(spaceId: string): Promise<Member[]> {
  const rows = await rest<Omit<Member, 'profile'>[]>(`workspace_members?select=user_id,role,joined_at&workspace_id=eq.${spaceId}&status=eq.active&order=joined_at.asc`);
  const profiles = await profilesOf(rows.map(r => r.user_id));
  return rows.map(r => ({ ...r, profile: profiles.get(r.user_id) ?? null }));
}
export const memberCounts = async (): Promise<Map<string, number>> => {
  const rows = await rest<{ workspace_id: string }[]>('workspace_members?select=workspace_id&status=eq.active');
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.workspace_id, (m.get(r.workspace_id) ?? 0) + 1);
  return m;
};

export const createSpace = (name: string, mode: WorkspaceMode, max: number) =>
  rpc<string>('create_workspace', { p_name: name, p_mode: mode, p_max_members: mode === 'couple' ? null : max });
export const createInvitation = (spaceId: string, uses: number) =>
  rpc<string>('create_invitation', { p_workspace: spaceId, p_max_uses: uses, p_valid_hours: 72 });
export const openInvitations = async (spaceId: string) =>
  (await rest<Invitation[]>(`workspace_invitations?select=id,max_uses,uses,expires_at&workspace_id=eq.${spaceId}&revoked_at=is.null&expires_at=gt.${enc(new Date().toISOString())}&order=created_at.desc`))
    .filter(i => i.uses < i.max_uses);
export const revokeInvitation = (id: string) => rpc<null>('revoke_invitation', { p_invitation: id });
export const peekInvitation = async (token: string) => (await rpc<InvitePreview[]>('peek_invitation', { p_token: token }))[0] ?? null;
export const acceptInvitation = (token: string) => rpc<string>('accept_invitation', { p_token: token });
export const leaveSpace = (spaceId: string) => rpc<null>('leave_workspace', { p_workspace: spaceId });
export const removeMember = (spaceId: string, user: string) => rpc<null>('remove_member', { p_workspace: spaceId, p_user: user });
export const transferOwnership = (spaceId: string, user: string) => rpc<null>('transfer_ownership', { p_workspace: spaceId, p_user: user });

export const myBlocks = async () => new Set((await rest<{ blocked_id: string }[]>('user_blocks?select=blocked_id')).map(b => b.blocked_id));
export const block = (user: string) => insert('user_blocks', { blocker_id: me(), blocked_id: user });
export const unblock = (user: string) => remove('user_blocks', `blocked_id=eq.${user}`);

export const mySharing = async (spaceId: string) =>
  (await rest<{ share_workouts: boolean; notify_workouts: boolean }[]>(`workspace_members?select=share_workouts,notify_workouts&workspace_id=eq.${spaceId}&user_id=eq.${me()}&status=eq.active`))[0] ?? null;
export const setSharing = (spaceId: string, share: boolean, notify: boolean) =>
  rpc<null>('set_workout_sharing', { p_workspace: spaceId, p_share: share, p_notify: notify });
