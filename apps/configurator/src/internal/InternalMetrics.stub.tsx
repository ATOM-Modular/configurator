/**
 * Public-build stand-in for InternalMetrics. Renders nothing and, crucially,
 * contains none of the cost/GP field names the CI bundle grep forbids.
 */
export function InternalMetrics(props: { estimate: unknown }): null {
  void props;
  return null;
}
