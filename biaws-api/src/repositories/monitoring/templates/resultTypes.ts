export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface MetadataField {
  key: string;
  type: string;
  required: boolean;
  enum?: JsonValue[];
  minimum?: number;
  maximum?: number;
  items?: string;
  maxItems?: number;
}
export interface UnifiedResultContract {
  output: {
    status: { enum: string[] };
    message: { required: boolean; maxLength: number };
    metadata: {
      required: boolean;
      fields: MetadataField[];
      additionalProperties: boolean;
    };
  };
  presentation: {
    series: { label: string; xKey: string; yKey: string; yFormatKey: string }[];
  };
}
