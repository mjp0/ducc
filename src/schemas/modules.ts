import { z } from "zod"
import { ModuleCallbacksT, ModuleFnAPIT } from "."

const DataObjectS: any = z.lazy(() =>
  z.object({
    type: z.string(),
    properties: z.union([z.record(DataObjectS), DataObjectS]).optional(),
    required: z.array(z.string()).optional(),
  })
)

const PathS = z.object({
  summary: z.string(),
  operationId: z.string(),
  tags: z.array(z.string()).optional(),
  requestBody: z.object({
    required: z.boolean(),
    content: z
      .record(
        z.object({
          schema: DataObjectS,
        })
      )
      .optional(),
  }),
  responses: z.record(
    z.object({
      description: z.string(),
      content: z.record(
        z.object({
          schema: DataObjectS,
        })
      ),
    })
  ),
})

export const ModuleS = z.object({
  id: z.string().nonempty(),
  fns: z.record(z.any()), // TODO: specify this (tired of trying to make zod work with functions)
  schema: z.object({
    info: z.object({
      title: z.string().optional().describe("filled in by the server"),
      description: z.string().nonempty(),
      version: z.string().nonempty(),
    }),
    paths: z.record(z.record(PathS)),
    components: z.object({ schemas: z.record(DataObjectS) }).optional(),
  }),
})
export type ModuleT = z.infer<typeof ModuleS>

export type MethodTypeT = (arg: ModuleCallbacksT & any) => Promise<ModuleFnAPIT>

export type SettingsT = {
  free?: boolean
  multiplier?: number
  [key: string]: any
}