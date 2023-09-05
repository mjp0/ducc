import { z } from "zod"
import { generateSchema } from "@anatine/zod-openapi"
import OpenAPIParser from "@readme/openapi-parser"
import { debug as Debug } from "debug"
import b4a from "b4a"

export function convertZod({ schema }: { schema: any }) {
  return generateSchema(schema)
}

export async function verifySchema({ schema }: { schema: any }) {
  try {
    let api = await OpenAPIParser.validate(schema)
    return api
  } catch (err) {
    return { error: err }
  }
}

export function debug(name: string) {
  return Debug(name)
}

export function devMode() {
  return process?.env?.DEBUG || !import.meta?.env?.PROD
}

export function varToByte(params: any) {
  return b4a.isBuffer(params) ? params.byteLength : new Blob([typeof params === "object" ? JSON.stringify(params) : params]).size || 0
}

// function to detect numbers in strings
export function isNumeric(str: string) {
  if (typeof str != "string") return false // we only process strings!
  // make sure it keeps integers and floats as floats
  return !isNaN(str as any) && !isNaN(parseFloat(str))
}

// parse floats into integers if they are whole numbers
export function parseNumber(str: string) {
  if (typeof str != "string") return str // we only process strings!
  // make sure it keeps integers and floats as floats
  if (isNumeric(str)) {
    if (str.indexOf(".") !== -1) {
      return parseFloat(str)
    }
    return parseInt(str)
  }
  return str
}