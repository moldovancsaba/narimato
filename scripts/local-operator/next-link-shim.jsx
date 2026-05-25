/**
 * Browser-safe stand-in for next/link in the :10006 operator bundle (no Next.js router).
 */
export default function Link({ href, children, target, rel, ...props }) {
  return (
    <a href={href} target={target} rel={rel} {...props}>
      {children}
    </a>
  );
}
