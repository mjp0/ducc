import { MethodTypeT, ModuleCallbacksT, ModuleFnAPIT, ModuleT, SettingsT } from "@/schemas"
import { ZodTypeAny } from "zod"
import { convertZod } from "../utils"
import Enforcer from "openapi-enforcer"
import _ from "lodash"

export const asAPI = (module: ModuleT) => {
  const mAPI: { [key: string]: Function } = {}
  Object.keys(module.schema.paths).map((path) => {
    const fn_id = path.replace("/", "")
    mAPI[fn_id] = async (data: ModuleCallbacksT & any): Promise<any> => {
      return new Promise((resolve, reject) => {
        module.fns[fn_id].fn({
          ...data,
          onData: data?.onData,
          onDone: resolve,
          onError: reject,
        })
      })
    }
  })
  return mAPI
}

export const moduleGenerator = async <T>({ id, desc, version }: { id: string; desc: string; version?: string }) => {
  const FNS: { [key: string]: { fn: MethodTypeT; desc: string; settings?: SettingsT } } = {}
  const PARAMS: { [key: string]: any } = {}
  const RESPONSES: { [key: string]: any[] } = {}

  const API = {
    addMethod: ({ id, fn, desc, settings }: { id: string; fn: MethodTypeT; desc: string; settings?: SettingsT }) => {
      FNS[id] = {
        fn: async (data: ModuleCallbacksT & any): Promise<ModuleFnAPIT> => fn(data),
        settings,
        desc,
      }
      const mAPI = {
        addInput: ({ schema }: { schema: ZodTypeAny }) => {
          if (PARAMS[id]) throw new Error(`Method ${id} already has an input, only one input per method allowed`)
          PARAMS[id] = convertZod({ schema })
          return mAPI
        },
        addOutput: ({ schema, desc, code }: { code: number; desc: string; schema: ZodTypeAny }) => {
          if (!RESPONSES[id]) RESPONSES[id] = []
          RESPONSES[id].push({ schema: convertZod({ schema }), desc, code })
          return mAPI
        },
        setMultiplier: ({ multiplier }: { multiplier: number }) => {
          if (!FNS[id]?.settings) FNS[id].settings = {}
          FNS[id].settings = { ...FNS[id].settings, multiplier }
          return mAPI
        },
      }
      return mAPI
    },
    run: async () => {
      const paths: { [key: string]: any } = {}
      Object.keys(FNS).forEach((fn_id) => {
        // create path object
        const no_body = {
          required: false,
          content: {},
        }
        paths[`/${fn_id}`] = {
          post: {
            summary: FNS[fn_id].desc,
            operationId: fn_id,
            tags: _.keys(FNS[fn_id].settings)?.map((k) => {
              const v = FNS[fn_id]?.settings?.[k]
              return `${k}=${v}`
            }), //FNS[fn_id].settings?.free ? ["free=true"] : [],
            requestBody: PARAMS[fn_id]
              ? {
                  required: true,
                  content: {
                    "application/json": {
                      schema: PARAMS[fn_id],
                    },
                  },
                }
              : no_body,
            responses: {},
          },
        }

        // add responses to each path
        RESPONSES[fn_id].forEach((res: any) => {
          paths[`/${fn_id}`].post.responses[res.code] = {
            description: res.desc,
            content: {
              "application/json": {
                schema: res.schema,
              },
            },
          }
        })
      })
      const fns: { [key: string]: any } = {}
      Object.keys(FNS).forEach((fn_id) => {
        fns[fn_id] = {
          fn: FNS[fn_id].fn,
          desc: FNS[fn_id].desc,
          settings: FNS[fn_id].settings,
        }
      })
      const module = {
        id,
        fns,
        schema: {
          openapi: "3.0.0",
          info: {
            title: id,
            description: desc,
            version: version || "1.0.0",
          },
          paths,
        },
      } as ModuleT

      const [api, error, warning] = await Enforcer(module.schema, {
        fullResult: true,
      })
      if (error) throw new Error(`Module ${id} verification failed: ${error.message()}`)
      return module
    },
  }
  return API
}
