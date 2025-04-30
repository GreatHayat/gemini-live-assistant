// Convert PCM base64 to Float32Array for the Web Audio API
export const convertBase64ToFloat32 = (base64Data: string): Float32Array => {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const pcmData = new Int16Array(bytes.buffer);
  const float32Data = new Float32Array(pcmData.length);

  for (let i = 0; i < pcmData.length; i++) {
    float32Data[i] = pcmData[i] / 32768.0;
  }

  return float32Data;
};
