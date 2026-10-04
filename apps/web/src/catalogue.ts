import { z } from 'zod';
import data from '../../../data/catalogue.v1.json';

const asset = z
  .string()
  .regex(/^\/(?!\/)[\w./-]+$/, 'Use a local, versioned asset')
  .refine(
    (path) => !path.split('/').some((part) => part === '.' || part === '..'),
    'Assets must stay in the public directory',
  );
export const fontSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    encodingFamily: z.enum(['Unicode', 'FML', 'ML-TT']),
    variant: z.string().min(1),
    description: z.string().min(1),
    cssFamily: z.string().min(1),
    licence: z
      .object({ spdx: z.string().min(1), notice: asset, redistributable: z.boolean() })
      .strict(),
    assets: z.object({ regular: asset, semibold: asset.optional() }).strict(),
    sampleText: z.string().min(1),
    verificationStatus: z.enum(['verified', 'pending']),
    mapVersion: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .nullable(),
    mapAsset: asset.nullable(),
    source: z.url(),
    packageVersion: z.string().min(1),
  })
  .strict()
  .superRefine((font, ctx) => {
    if (font.encodingFamily === 'Unicode' && (font.mapAsset || font.mapVersion)) {
      ctx.addIssue({ code: 'custom', message: 'Unicode fonts do not have a legacy map' });
    }
    if (
      font.encodingFamily !== 'Unicode' &&
      font.verificationStatus === 'verified' &&
      (!font.mapAsset || !font.mapVersion)
    ) {
      ctx.addIssue({ code: 'custom', message: 'Verified legacy fonts require a versioned map' });
    }
  });

export const catalogueSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    fonts: z.array(fontSchema),
  })
  .strict()
  .superRefine((catalogue, ctx) => {
    if (new Set(catalogue.fonts.map((font) => font.id)).size !== catalogue.fonts.length) {
      ctx.addIssue({ code: 'custom', message: 'Font ids must be unique' });
    }
  });
export type FontRecord = z.infer<typeof fontSchema>;
export const catalogue = catalogueSchema.parse(data);
export const fonts = catalogue.fonts.filter(
  (font) =>
    font.encodingFamily === 'Unicode' &&
    font.verificationStatus === 'verified' &&
    font.licence.redistributable,
);
