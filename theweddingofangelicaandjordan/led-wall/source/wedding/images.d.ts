// the review sheet shows the picture straight from this folder (Remotion's bundler serves imported images)
declare module "*.png" {
  const src: string;
  export default src;
}
