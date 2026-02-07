declare module "bcryptjs" {
  // Minimal typings for the parts used in this project.
  export function hash(
    data: string,
    saltOrRounds: string | number,
  ): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}
