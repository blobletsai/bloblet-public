declare module 'pg' {
  export interface QueryResult<T = any> {
    rows: T[]
    rowCount: number
  }

  export interface PoolConfig {
    connectionString?: string
    max?: number
    ssl?: any
  }

  export interface PoolClient {
    query<T = any>(queryText: string, values?: any[]): Promise<QueryResult<T>>
    release(): void
  }

  export class Pool {
    constructor(config?: PoolConfig)
    connect(): Promise<PoolClient>
    end(): Promise<void>
  }
}
