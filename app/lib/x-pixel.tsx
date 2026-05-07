// Standard X (Twitter) website tag. Lives in <head> alongside the Meta
// Pixel so retargeting/conversion audiences can be built from the same
// PageView traffic. Custom events can be fired later via window.twq.

const X_PIXEL_ID = process.env.NEXT_PUBLIC_X_PIXEL_ID;

// The loader IIFE is idempotent (e.twq guard), but the original snippet
// calls twq('config', id) unconditionally. If Next ever re-evaluates this
// inline script (hydration, route remount), config fires twice and the X
// Pixel Helper warns "activated more than once". Gate the config call on
// a window flag so it only runs the first time.
const pixelScript = (id: string) => `
!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
window.__twqConfigured||(twq('config','${id}'),window.__twqConfigured=true);
`;

export function XPixelHead() {
  if (!X_PIXEL_ID) return null;
  return <script dangerouslySetInnerHTML={{ __html: pixelScript(X_PIXEL_ID) }} />;
}

declare global {
  interface Window {
    twq?: (...args: unknown[]) => void;
  }
}
