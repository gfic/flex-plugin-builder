/**
 * Exits unless --no-process-exit flag is provided
 *
 * @param exitCode  the exitCode
 * @param args      the process argument
 */
const exit = (exitCode: number, args: string[] = []) => {
  // Exit if not an embedded script
  if (!args.includes('--no-process-exit')) {
    process.exit(exitCode);
  }
};

export default exit;