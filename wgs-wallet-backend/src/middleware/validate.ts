import { NextFunction, Request, Response } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (e: any) {
      res.status(400).json({ error: e?.message || 'Invalid request' })
    }
  }
}


