// @ignoreFile
/* eslint-disable */
/**
 * Generated utilities for implementing server-side Convex query and mutation functions.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ActionBuilder,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server"
import type { DataModel } from "./dataModel.js"

type Env = {
  readonly CONVEX_CLOUD_URL: string
  readonly CONVEX_SITE_URL: string
  readonly POSTHOG_FLAGS_POLLING_INTERVAL_SECONDS: string | undefined
  readonly POSTHOG_HOST: string | undefined
  readonly POSTHOG_PERSONAL_API_KEY: string | undefined
  readonly POSTHOG_PROJECT_TOKEN: string | undefined
}

export declare const query: QueryBuilder<DataModel, "public">
export declare const internalQuery: QueryBuilder<DataModel, "internal">
export declare const mutation: MutationBuilder<DataModel, "public">
export declare const internalMutation: MutationBuilder<DataModel, "internal">
export declare const action: ActionBuilder<DataModel, "public">
export declare const internalAction: ActionBuilder<DataModel, "internal">
export declare const httpAction: HttpActionBuilder
export declare const env: Env

export type QueryCtx = GenericQueryCtx<DataModel>
export type MutationCtx = GenericMutationCtx<DataModel>
export type ActionCtx = GenericActionCtx<DataModel>
export type DatabaseReader = GenericDatabaseReader<DataModel>
export type DatabaseWriter = GenericDatabaseWriter<DataModel>
