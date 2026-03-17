declare module 'quoted-printable' {
  export function decode(input: string): string;
  export function encode(input: string): string;
}
