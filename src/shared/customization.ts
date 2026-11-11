import type {
  AmazonCustomization,
  AmazonCustomizationDropdown,
  AmazonCustomizationSurface,
  AmazonCustomizationTextInput,
} from '../adapters/marketplace-adapter';

/** Text exactly as typed in the manual Amazon customization form. Never persisted. */
export interface TextInputDraft { label: string; maxChars: string; allowedCharTypes: string }
export interface DropdownDraft { label: string; options: string }
export interface ImageInputDraft { label: string }
export interface SurfaceDraft {
  name: string;
  textInputs: TextInputDraft[];
  dropdowns: DropdownDraft[];
  imageInputs: ImageInputDraft[];
}
export interface CustomizationDraft { surfaces: SurfaceDraft[] }

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function lines(value: string, separator: RegExp): string[] | undefined {
  const entries = value.split(separator).map((entry) => entry.trim()).filter(Boolean);
  return entries.length ? entries : undefined;
}

function parseMaxChars(value: string, where: string): number | undefined {
  const text = value.trim();
  if (!text) return undefined;
  if (!/^-?\d+(?:\.\d+)?$/u.test(text)) throw new Error(`${where}: max_chars phải là một số.`);
  return Number(text);
}

/**
 * Builds the optional `customization` block of an Amazon listing exactly as the input schema describes it.
 * Every row the user added is sent, in order, as written: a row is never merged, reordered or dropped, so the API can
 * report an input without `max_chars`. No surface at all means no block, so the listing is checked as before.
 */
export function buildCustomization(draft: CustomizationDraft): AmazonCustomization | undefined {
  if (draft.surfaces.length === 0) return undefined;
  const surfaces = draft.surfaces.map((surface, surfaceIndex): AmazonCustomizationSurface => {
    const name = optional(surface.name);
    const textInputs = surface.textInputs.map((input, index): AmazonCustomizationTextInput => {
      const label = optional(input.label);
      const maxChars = parseMaxChars(input.maxChars, `Bề mặt ${surfaceIndex + 1}, ô văn bản ${index + 1}`);
      const allowed = lines(input.allowedCharTypes, /[,\r\n]/u);
      return {
        ...(label ? { label } : {}),
        ...(maxChars === undefined ? {} : { max_chars: maxChars }),
        ...(allowed ? { allowed_char_types: allowed } : {}),
      };
    });
    const dropdowns = surface.dropdowns.map((dropdown): AmazonCustomizationDropdown => {
      const label = optional(dropdown.label);
      const options = lines(dropdown.options, /\r?\n/u);
      return { ...(label ? { label } : {}), ...(options ? { options } : {}) };
    });
    const imageInputs = surface.imageInputs.map((input) => {
      const label = optional(input.label);
      return label ? { label } : {};
    });
    return {
      ...(name ? { name } : {}),
      ...(textInputs.length ? { text_inputs: textInputs } : {}),
      ...(dropdowns.length ? { dropdowns } : {}),
      ...(imageInputs.length ? { image_inputs: imageInputs } : {}),
    };
  });
  return { surfaces };
}
