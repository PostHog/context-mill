export declare const login: import("convex/server").RegisteredMutation<"public", {
    email: string;
    sessionId?: string | undefined;
    userId: string;
}, Promise<void>>;
export declare const considerBurrito: import("convex/server").RegisteredMutation<"public", {
    anonymousId: string;
    sessionId?: string | undefined;
    totalConsiderations: number;
    userId?: string | undefined;
}, Promise<void>>;
export declare const dashboard: import("convex/server").RegisteredAction<"public", {
    anonymousId: string;
    sessionId?: string | undefined;
    userId?: string | undefined;
}, Promise<{
    showNewFeature: boolean;
}>>;
export declare const profile: import("convex/server").RegisteredAction<"public", {
    anonymousId: string;
    sessionId?: string | undefined;
    userId?: string | undefined;
}, Promise<{
    message: string;
}>>;
