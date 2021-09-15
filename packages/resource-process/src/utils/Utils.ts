export function str2ab(str: string = ""): ArrayBuffer {
  const buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  const bufView = new Uint16Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

/**
 * Array buffer to string.
 * @param buf
 */
export function ab2str(buf: ArrayBuffer) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

/**
 * Creates a new Uint8Array based on two different ArrayBuffers.
 * @param buffers - The buffer which concat
 * @return The new ArrayBuffer created out of the two
 */
export function arrayBufferConcat(...buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLen = buffers.reduce((pre, curr) => pre + curr.byteLength, 0);
  const tmp = new Uint8Array(totalLen);
  buffers.reduce((pre, curr) => {
    tmp.set(new Uint8Array(curr), pre);
    return pre + curr.byteLength;
  }, 0);
  return tmp.buffer;
}

export function ab2Image(arrayBuffer: ArrayBuffer): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      resolve(img);
    };
  });
}

/**
 * Load image buffer.
 * @param imageBuffer - image array buffer
 * @param type - image type(png/jpg/webp)
 */
export function loadImageBuffer(imageBuffer: ArrayBuffer, type: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new window.Blob([imageBuffer], { type });
    const img = new Image();
    img.src = URL.createObjectURL(blob);

    img.crossOrigin = "anonymous";
    img.onerror = function () {
      reject(new Error("Failed to load image buffer"));
    };
    img.onload = function () {
      // Call requestAnimationFrame to avoid iOS's bug.
      requestAnimationFrame(() => {
        resolve(img);
      });
    };
  });
}
