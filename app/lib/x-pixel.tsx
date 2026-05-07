// Standard X (Twitter) website tag. Lives in <head> alongside the Meta
// Pixel so retargeting/conversion audiences can be built from the same
// PageView traffic. Custom events can be fired later via window.twq.

const X_PIXEL_ID = process.env.NEXT_PUBLIC_X_PIXEL_ID;

const pixelScript = (id: string) => `
!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
twq('config','${id}');
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
