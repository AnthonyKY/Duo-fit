// Mirrors supabase/migrations/202611140001_collabfit_foundation.sql. Health data (workouts, body composition) is not here:
// it stays on the phone; only "started / completed" events a member chose to share reach the server.
export type UserId = string & { readonly __brand: 'UserId' };
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };
export type WorkspaceMode = 'couple' | 'friends';
export type MemberRole = 'owner' | 'member';
export type MembershipStatus = 'active' | 'left' | 'removed';

export interface UserProfile {
  id: UserId;
  displayName: string;
  avatarSeed: string;
  avatarPath: string | null;
  createdAt: string;
}
export interface Workspace {
  id: WorkspaceId;
  name: string;
  mode: WorkspaceMode;
  maxMembers: number;
  ownerId: UserId | null;
  createdAt: string;
}
export interface Membership {
  workspaceId: WorkspaceId;
  userId: UserId;
  role: MemberRole;
  status: MembershipStatus;
  shareWorkouts: boolean;
  notifyWorkouts: boolean;
  joinedAt: string;
  leftAt: string | null;
}
export interface ChatMessage {
  id: string;
  clientId: string;
  workspaceId: WorkspaceId;
  authorId: UserId | null;
  body: string | null;
  imagePath: string | null;
  createdAt: string;
  deletedAt: string | null;
}
export type WorkoutEventType = 'started' | 'completed';
export interface WorkoutEvent {
  id: string;
  workspaceId: WorkspaceId;
  userId: UserId | null;
  workoutRef: string;
  type: WorkoutEventType;
  createdAt: string;
}
