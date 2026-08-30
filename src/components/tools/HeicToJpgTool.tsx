"use client";

import { heicToJpg } from "@/lib/tools/heicToJpg";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function HeicToJpgTool({ onSend }: { onSend?: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept=".heic,.heif,image/heic,image/heif"
      allowBatch
      dropLabel="Drop one or more HEIC photos here, or click to choose"
      dropHint="iPhone photos in Apple's HEIC format"
      convertOne={(file) => heicToJpg(file)}
      options={null}
      setOptions={() => {}}
      convertLabel="Convert to JPG"
      onSend={onSend}
    />
  );
}
