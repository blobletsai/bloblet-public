declare module 'tweetnacl' {
  const nacl: any
  export default nacl
  export const sign: any
}

declare module 'react-test-renderer' {
  const renderer: any
  export default renderer
  export const act: any
  export function create(...args: any[]): any
}
