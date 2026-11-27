// @ignoreFile
/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { AnyDataModel } from "convex/server"
import type { GenericId } from "convex/values"

export type TableNames = string
export type Doc = any
export type Id<TableName extends TableNames = TableNames> = GenericId<TableName>
export type DataModel = AnyDataModel
