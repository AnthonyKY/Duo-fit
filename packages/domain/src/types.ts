export type UserId = string & { readonly __brand: 'UserId' };
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };
export type WorkspaceMode = 'couple' | 'friends';
export type MemberRole = 'owner' | 'member';
export type MembershipStatus = 'invited' | 'active' | 'left' | 'removed';

export interface UserProfile {
  id: UserId;
  displayName: string;
  avatarPath: string | null;
  createdAt: string;
}
export interface Workspace {
  id: WorkspaceId;
  name: string;
  mode: WorkspaceMode;
  ownerId: UserId;
  createdAt: string;
}
export interface Membership {
  workspaceId: WorkspaceId;
  userId: UserId;
  role: MemberRole;
  status: MembershipStatus;
  joinedAt: string | null;
}
export interface ChatMessage {
  id: string;
  workspaceId: WorkspaceId;
  authorId: UserId;
  body: string | null;
  imagePath: string | null;
  createdAt: string;
  deletedAt: string | null;
}
export type WorkoutEventType = 'started' | 'completed';
export interface WorkoutEvent {
  id: string;
  userId: UserId;
  workspaceId: WorkspaceId;
  type: WorkoutEventType;
  workoutId: string;
  createdAt: string;
}
export function workspaceCapacity(mode: WorkspaceMode): number {
  return mode === 'couple' ? 2 : 50;
}
