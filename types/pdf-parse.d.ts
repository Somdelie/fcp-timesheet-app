declare module "pdf-parse" {
  const parse: (
    data: Buffer | Uint8Array | string,
    options?: any,
  ) => Promise<any> | any;
  export default parse;
}

declare module "pdf-parse/lib/pdf-parse" {
  const parse: (
    data: Buffer | Uint8Array | string,
    options?: any,
  ) => Promise<any> | any;
  export default parse;
}
