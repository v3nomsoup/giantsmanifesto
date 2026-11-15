import { COUNTRY_CODES } from '../countries';
import { isValidEmail } from '../email';

export interface SignatureInput {
  displayName: string;
  affiliation: string;
  country: string;
  email: string;
  consent: boolean;
}

export type SignatureField = keyof SignatureInput;

export type SignatureFormResult =
  | { ok: true; value: SignatureInput }
  | { ok: false; errors: Partial<Record<SignatureField, string>>; values: SignatureInput };

export const NAME_MAX = 80;
export const AFFILIATION_MAX = 120;

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

/** Length in characters (code points), not UTF-16 units. */
const length = (value: string) => [...value].length;

/** Validates the email signing form. Error values are i18n keys under `form.errors`. */
export function parseSignatureForm(form: FormData): SignatureFormResult {
  const values: SignatureInput = {
    displayName: text(form, 'displayName'),
    affiliation: text(form, 'affiliation'),
    country: text(form, 'country'),
    email: text(form, 'email'),
    consent: form.get('consent') !== null,
  };
  const errors: Partial<Record<SignatureField, string>> = {};

  if (values.displayName === '') errors.displayName = 'form.errors.nameRequired';
  else if (length(values.displayName) > NAME_MAX) errors.displayName = 'form.errors.nameTooLong';
  if (length(values.affiliation) > AFFILIATION_MAX) {
    errors.affiliation = 'form.errors.affiliationTooLong';
  }
  if (values.country !== '' && !COUNTRY_CODES.includes(values.country)) {
    errors.country = 'form.errors.countryInvalid';
  }
  if (values.email === '') errors.email = 'form.errors.emailRequired';
  else if (!isValidEmail(values.email)) errors.email = 'form.errors.emailInvalid';
  if (!values.consent) errors.consent = 'form.errors.consentRequired';

  return Object.keys(errors).length === 0
    ? { ok: true, value: values }
    : { ok: false, errors, values };
}
