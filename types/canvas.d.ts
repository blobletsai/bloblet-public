declare module 'canvas' {
  export function createCanvas(
    width: number,
    height: number
  ): {
    getContext(type: '2d'): {
      imageSmoothingEnabled: boolean
      clearRect(x: number, y: number, width: number, height: number): void
      drawImage(image: { width: number; height: number }, x: number, y: number, width: number, height: number): void
    }
    toBuffer(type: 'image/png'): Buffer
  }

  export function loadImage(
    input: Buffer | ArrayBuffer | Uint8Array
  ): Promise<{ width: number; height: number }>
}
